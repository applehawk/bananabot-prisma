
import { PrismaClient, FSMTriggerType, FSMEvent, LifecycleState, Prisma, FSMActionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Use LifecycleState from Prisma
const States = LifecycleState;

const FSM_VERSION = {
    ID: 1,
    NAME: 'v1.0.0 Core Lifecycle FSM',
};

async function main() {
    console.log('🧹 Clearing old FSM data...');
    // Cleanup existing FSM data
    await prisma.userFSMState.deleteMany({});
    await prisma.fSMTransition.deleteMany({});
    await prisma.fSMState.deleteMany({});
    await prisma.fSMVersion.deleteMany({});
    console.log('✨ Data cleared.');

    console.log('🌱 Seeding Core Lifecycle FSM (Smart Linear Style)...');

    // 1. Create Version
    const version = await prisma.fSMVersion.create({
        data: {
            id: FSM_VERSION.ID,
            name: FSM_VERSION.NAME,
            isActive: true,
        },
    });
    console.log(`✅ Version Created: ${version.name}`);

    // 2. Create States
    const stateConfigs = [
        { code: States.NEW, x: 0, y: 0, isInitial: true },
        { code: States.ACTIVATING, x: 250, y: 0 },
        { code: States.ACTIVE_FREE, x: 500, y: 0 },
        { code: States.PAYWALL, x: 500, y: 300 },
        { code: States.PAID_ACTIVE, x: 750, y: 0 },
        { code: States.INACTIVE, x: 500, y: 600 },
        { code: States.CHURNED, x: 500, y: 900, isTerminal: true },
        { code: States.BLOCKED, x: 1000, y: 900, isTerminal: true },
    ];

    const stateIds: Record<string, string> = {};

    for (const config of stateConfigs) {
        const state = await prisma.fSMState.create({
            data: {
                versionId: version.id,
                name: config.code,
                description: `Lifecycle: ${config.code}`,
                isInitial: config.isInitial || false,
                isTerminal: config.isTerminal || false,
                positionX: config.x,
                positionY: config.y
            }
        });
        stateIds[config.code] = state.id;
    }
    console.log(`✅ States Created: ${Object.keys(stateIds).length}`);


    // 3. Transitions Helper (Supports ANY)
    let transitionCount = 0;

    const createTransition = async (
        from: LifecycleState | 'ANY',
        to: LifecycleState,
        trigger: { type: FSMTriggerType; event?: FSMEvent; minutes?: number },
        options: {
            priority?: number;
            conditions?: { field: string; operator: string; value: string; groupId?: number }[];
            comment?: string;
        } = {}
    ) => {
        const sources = from === 'ANY' ? Object.values(States) : [from];

        for (const source of sources) {
            // "ANY" Logic: Skip self and BLOCKED (unless specified otherwise)
            if (from === 'ANY') {
                if (source === to) continue;
                if (source === States.BLOCKED) continue;
            }

            if (!stateIds[source] || !stateIds[to]) {
                console.warn(`⚠️ Skipping ${source}->${to}: State ID missing`);
                continue;
            }

            // Implicit Action logging
            const actions = [];
            if (options.comment) {
                actions.push({
                    type: FSMActionType.LOG_EVENT,
                    config: { message: options.comment }
                });
            }

            await prisma.fSMTransition.create({
                data: {
                    versionId: version.id,
                    fromStateId: stateIds[source],
                    toStateId: stateIds[to],
                    triggerType: trigger.type,
                    triggerEvent: trigger.event,
                    timeoutMinutes: trigger.minutes,
                    priority: options.priority || 0,
                    conditions: {
                        create: (options.conditions || []).map(c => ({
                            field: c.field,
                            operator: c.operator,
                            value: String(c.value),
                            groupId: c.groupId || 0
                        }))
                    },
                    actions: {
                        create: actions.map((a, idx) => ({
                            type: a.type,
                            config: a.config || {},
                            order: idx
                        }))
                    }
                }
            });
            transitionCount++;
        }
    };

    console.log('🔗 Creating Transitions...');

    // === 1. GLOBAL TRANSITIONS ===
    // Payment -> PAID_ACTIVE
    await createTransition('ANY', States.PAID_ACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.PAYMENT_COMPLETED },
        { priority: 100, comment: "Payment always activates" }
    );

    // Block/Unblock
    await createTransition('ANY', States.BLOCKED,
        { type: FSMTriggerType.EVENT, event: FSMEvent.USER_BLOCKED },
        { priority: 100, comment: "Admin Block" }
    );
    await createTransition('ANY', States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.USER_UNBLOCKED },
        { priority: 50, comment: "Return from block to inactive" }
    );


    // === 2. ONBOARDING / ACTIVATION ===
    // NEW -> ACTIVATING (First Gen)
    await createTransition(States.NEW, States.ACTIVATING,
        { type: FSMTriggerType.EVENT, event: FSMEvent.GENERATION_COMPLETED },
        {
            conditions: [{ field: 'totalGenerations', operator: '>=', value: '1' }],
            comment: "First generation made"
        }
    );

    // ACTIVATING -> ACTIVE_FREE (2+ Gen)
    await createTransition(States.ACTIVATING, States.ACTIVE_FREE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.GENERATION_COMPLETED },
        {
            conditions: [{ field: 'totalGenerations', operator: '>=', value: '2' }],
            comment: "User engaged (>=2 gens)"
        }
    );

    // Abandonment (Early)
    await createTransition(States.NEW, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        { conditions: [{ field: 'hoursSinceLastActivity', operator: '>', value: '24' }], comment: "Abandoned at start" }
    );
    await createTransition(States.ACTIVATING, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        { conditions: [{ field: 'hoursSinceLastActivity', operator: '>', value: '24' }], comment: "Abandoned activating" }
    );


    // === 3. FREE LOOP ===
    // Free -> Paywall
    await createTransition(States.ACTIVE_FREE, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_CHANGED },
        { conditions: [{ field: 'credits', operator: '<', value: '5.1' }], comment: "Free credits exhausted" }
    );

    // Edge case: Ran out early
    await createTransition(States.NEW, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_CHANGED },
        { conditions: [{ field: 'credits', operator: '<', value: '5.1' }] }
    );
    await createTransition(States.ACTIVATING, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_CHANGED },
        { conditions: [{ field: 'credits', operator: '<', value: '5.1' }] }
    );

    // Free -> Inactive
    await createTransition(States.ACTIVE_FREE, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        { conditions: [{ field: 'hoursSinceLastActivity', operator: '>', value: '24' }], comment: "Abandoned free" }
    );


    // === 4. PAYWALL ===
    // Paywall -> Inactive
    await createTransition(States.PAYWALL, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        { conditions: [{ field: 'hoursSinceLastActivity', operator: '>', value: '24' }], comment: "Didn't buy" }
    );


    // === 5. PAID LOOP ===
    // Paid -> Paywall
    await createTransition(States.PAID_ACTIVE, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_CHANGED },
        { conditions: [{ field: 'credits', operator: '<', value: '5.1' }], comment: "Paid credits exhausted" }
    );

    // Paid -> Inactive (Longer timeout)
    await createTransition(States.PAID_ACTIVE, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        { conditions: [{ field: 'hoursSinceLastActivity', operator: '>', value: '168' }], comment: "Paid user cooled off" }
    );


    // === 6. INACTIVITY & CHURN ===
    // Resurrection
    await createTransition(States.INACTIVE, States.ACTIVE_FREE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.GENERATION_COMPLETED },
        { conditions: [{ field: 'credits', operator: '>', value: '0' }], comment: "Came back freely" }
    );

    // Churn
    await createTransition(States.INACTIVE, States.CHURNED,
        { type: FSMTriggerType.TIME, minutes: 7 * 24 * 60 },
        { comment: "Final Churn" }
    );


    console.log(`🔗 Transitions Created: ${transitionCount}`);
    console.log('✅ Seeding Complete: Core Lifecycle FSM (Smart Linear Style)');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
