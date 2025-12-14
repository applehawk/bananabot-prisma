
import { PrismaClient, FSMTriggerType, FSMEvent, FSMActionType, LifecycleState } from '@prisma/client';

const prisma = new PrismaClient();

// Use LifecycleState from Prisma
const States = LifecycleState;

async function main() {
    console.log('🌱 Seeding 2-Level Lifecycle FSM...');

    // 1. Cleanup Old FSM Data (Optional but recommended for strict migration)
    // console.log('🧹 Cleaning up old FSM versions...');
    // await prisma.fSMTransition.deleteMany({});
    // await prisma.fSMState.deleteMany({});
    // await prisma.fSMVersion.deleteMany({});

    // 2. Create/Get Version
    const version = await prisma.fSMVersion.upsert({
        where: { id: 2 }, // Using ID 2 for the new version
        update: {},
        create: {
            id: 2,
            name: 'v2.0.0 Lifecycle FSM',
            isActive: true, // Set this active
        },
    });

    // Deactivate old version if exists
    await prisma.fSMVersion.updateMany({
        where: { id: { not: version.id } },
        data: { isActive: false }
    });

    console.log(`✅ Active FSM Version: ${version.name} (ID: ${version.id})`);

    // 3. Create 8 Core States
    const stateIds: Record<string, string> = {};
    const stateCodes = Object.values(States);

    // Layout helpers
    let y = 0;
    const xStep = 250;

    // Grouping for visual layout (approximate)
    const phases = [
        [States.NEW, States.ACTIVATING],
        [States.ACTIVE_FREE, States.PAYWALL],
        [States.PAID_ACTIVE, States.INACTIVE],
        [States.CHURNED, States.BLOCKED]
    ];

    for (const phase of phases) {
        let x = 0;
        for (const code of phase) {
            const isInitial = code === States.NEW;
            const isTerminal = ([States.CHURNED, States.BLOCKED] as LifecycleState[]).includes(code);

            const state = await prisma.fSMState.upsert({
                where: { versionId_name: { versionId: version.id, name: code } },
                update: {
                    description: `Lifecycle: ${code}`,
                    isInitial,
                    isTerminal,
                    positionX: x,
                    positionY: y
                },
                create: {
                    versionId: version.id,
                    name: code,
                    description: `Lifecycle: ${code}`,
                    isInitial,
                    isTerminal,
                    positionX: x,
                    positionY: y
                }
            });
            stateIds[code] = state.id;
            x += xStep;
        }
        y += 150;
    }

    console.log(`✅ States Synced: ${Object.keys(stateIds).length}`);

    // 4. Create Transitions
    // Helper
    const createTransition = async (
        from: LifecycleState,
        to: LifecycleState,
        trigger: { type: FSMTriggerType, event?: FSMEvent, minutes?: number },
        priority = 0,
        conditions: any[] = []
    ) => {
        if (!stateIds[from] || !stateIds[to]) return;

        // Clean existing for idempotency
        // (Simplified: we usually delete all for the version before seeding, 
        // but here we just create. In a real script we might wipe transitions first).

        await prisma.fSMTransition.create({
            data: {
                versionId: version.id,
                fromStateId: stateIds[from],
                toStateId: stateIds[to],
                triggerType: trigger.type,
                triggerEvent: trigger.event,
                timeoutMinutes: trigger.minutes,
                priority,
                // Actions shouldn't typically be here for pure Lifecycle, 
                // but we might add tagging or logging if needed.
                actions: {
                    create: [] // No actions as per architecture (Overlays handle effects)
                },
                conditions: {
                    create: conditions.map(c => ({
                        field: c.field,
                        operator: c.operator,
                        value: String(c.value),
                        groupId: c.groupId || 0
                    }))
                }
            }
        });
    };

    // Wiping transitions for this version to ensure clean slate
    await prisma.fSMTransition.deleteMany({ where: { versionId: version.id } });
    console.log('🔗 Creating Transitions...');

    // -- Activation Flow --
    // NEW -> ACTIVATING (On Start)
    await createTransition(States.NEW, States.ACTIVATING,
        { type: FSMTriggerType.EVENT, event: FSMEvent.BOT_START });

    // ACTIVATING -> ACTIVE_FREE (After usage)
    await createTransition(States.ACTIVATING, States.ACTIVE_FREE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.GENERATION }, 0,
        [{ field: 'totalGenerations', operator: '>=', value: '3' }] // Rule from guide
    );

    // -- Free Loop & Paywall --
    // ACTIVE_FREE -> PAYWALL (Out of credits)
    await createTransition(States.ACTIVE_FREE, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_ZERO });

    // Also catch negative/insufficient checks if triggered
    await createTransition(States.ACTIVE_FREE, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.INSUFFICIENT_CREDITS });

    // -- Paid Loop --
    // PAYWALL -> PAID_ACTIVE (Payment)
    await createTransition(States.PAYWALL, States.PAID_ACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.PAYMENT_COMPLETED });

    // ANY -> PAID_ACTIVE (Payment from anywhere usually activates)
    await createTransition(States.ACTIVE_FREE, States.PAID_ACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.PAYMENT_COMPLETED });
    await createTransition(States.ACTIVATING, States.PAID_ACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.PAYMENT_COMPLETED });

    // PAID_ACTIVE -> PAYWALL (Exhausted paid credits)
    // Note: 'paidCredits' isn't explicitly on User (just 'credits'), 
    // so we use 'credits <= 0' and 'isPaidUser' logic if needed, 
    // but the FSM guide says "paidCredits <= 0". We assume CREDITS_ZERO event works for both.
    await createTransition(States.PAID_ACTIVE, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_ZERO });

    // -- Inactivity & Churn --
    // ANY -> INACTIVE (Time since last activity)
    const activeStates = [States.ACTIVATING, States.ACTIVE_FREE, States.PAID_ACTIVE];
    for (const s of activeStates) {
        await createTransition(s, States.INACTIVE,
            { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY }, 0,
            [{ field: 'hoursSinceLastActivity', operator: '>', value: '168' }] // 7 days (Example X)
        );
    }

    // INACTIVE -> CHURNED (Time since entering inactive state or long silence)
    await createTransition(States.INACTIVE, States.CHURNED,
        { type: FSMTriggerType.TIME, minutes: 30 * 24 * 60 } // 30 days (Example Y)
    );

    // -- Terminal --
    // ANY -> BLOCKED (Can happen from anywhere via admin)
    // We don't necessarily need explicit transitions for manual admin actions if state is just set,
    // but having them allows the event 'USER_BLOCKED' (if it existed) to drive it.
    // For now, we assume manual update or specific triggers. 

    console.log('✅ Seeding Complete: Lifecycle FSM v2.0.0');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
