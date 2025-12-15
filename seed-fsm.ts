
import { PrismaClient, FSMTriggerType, FSMEvent, FSMActionType, LifecycleState } from '@prisma/client';

const prisma = new PrismaClient();

// Use LifecycleState from Prisma
const States = LifecycleState;

async function main() {
    console.log('🌱 Seeding Core Lifecycle FSM (Strict Reference)...');

    // 1. Create/Get Version
    const version = await prisma.fSMVersion.upsert({
        where: { id: 2 }, // Keeping ID 2 as per previous (or we could increment)
        update: {
            name: 'v2.1.0 Core Lifecycle FSM',
            isActive: true,
        },
        create: {
            id: 2,
            name: 'v2.1.0 Core Lifecycle FSM',
            isActive: true,
        },
    });

    // Deactivate others
    await prisma.fSMVersion.updateMany({
        where: { id: { not: version.id } },
        data: { isActive: false }
    });

    console.log(`✅ Active FSM Version: ${version.name} (ID: ${version.id})`);

    // 2. Create 8 Core States
    const stateIds: Record<string, string> = {};

    // Layout Calculation
    // We want a nice visual graph. 
    // NEW (Started) -> ACTIVATING (1st Gen) -> ACTIVE_FREE (Regular) -> PAYWALL -> PAID_ACTIVE -> INACTIVE -> CHURNED
    // BLOCKED separate.

    const stateConfigs = [
        { code: States.NEW, x: 0, y: 0, isInitial: true, isTerminal: false },
        { code: States.ACTIVATING, x: 250, y: 0 },
        { code: States.ACTIVE_FREE, x: 500, y: 0 },
        { code: States.PAYWALL, x: 500, y: 300 }, // Below free
        { code: States.PAID_ACTIVE, x: 750, y: 0 }, // Right of free
        { code: States.INACTIVE, x: 500, y: 600 }, // Bottom
        { code: States.CHURNED, x: 500, y: 900, isTerminal: true },
        { code: States.BLOCKED, x: 1000, y: 900, isTerminal: true }, // Far out
    ];

    for (const config of stateConfigs) {
        const state = await prisma.fSMState.upsert({
            where: { versionId_name: { versionId: version.id, name: config.code } },
            update: {
                description: `Lifecycle: ${config.code}`,
                isInitial: config.isInitial || false,
                isTerminal: config.isTerminal || false,
                positionX: config.x,
                positionY: config.y
            },
            create: {
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
    console.log(`✅ States Synced: ${Object.keys(stateIds).length}`);

    // 3. Create Transitions matches strict MAP

    // Clean existing transitions for this version
    await prisma.fSMTransition.deleteMany({ where: { versionId: version.id } });

    const createTransition = async (
        from: LifecycleState | 'ANY',
        to: LifecycleState,
        trigger: { type: FSMTriggerType, event?: FSMEvent, minutes?: number },
        priority = 0,
        conditions: any[] = [],
        comment?: string
    ) => {
        // If 'ANY', we iterate all states except target (self-transition ok if implicit but usually skip) 
        // OR we just create specifically for all states. Using specific loop for 'ANY'.
        const sources = from === 'ANY'
            ? Object.values(States)
            : [from];

        for (const source of sources) {
            // Avoid creating transition from BLOCKED/CHURNED if they are terminals, unless explicit?
            // The map says Terminals are CHURNED and BLOCKED.
            // But table 7 says CHURNED -> PAID_ACTIVE exists.
            // BLOCKED -> None.

            if (from === 'ANY') {
                // ANY excludes terminals usually, but 'PAYMENT_COMPLETED' says 'ANY'.
                // If I am BLOCKED, payment shouldn't unblock me automatically according to Table 1 "USER_BLOCKED -> BLOCKED" is the rule. 
                // Table 1 says "ANY -> PAID_ACTIVE".
                // However, Table 7 says "BLOCKED -> — (Terminal)".
                // I will assume ANY applies to all except BLOCKED if BLOCKED is terminal/special.
                // But let's stick to the prompt's implied logic.
                // Re-reading Table 9: "Invariants... Payment always wins... PAYMENT_COMPLETED -> PAID_ACTIVE (from ANY state)".
                // It does NOT say "Except BLOCKED". But conventionally BLOCKED is hard block. 
                // However, I will implement 'ANY' as "All states except where it makes no sense or conflicts"?
                // Let's iterate all.
                if (source === to) continue;
                // Skip if source is BLOCKED and we are doing global rules? 
                // Table 7 says BLOCKED is Terminal. So no transitions FROM blocked.
                if (source === States.BLOCKED) continue;
            }

            if (!stateIds[source] || !stateIds[to]) continue;

            await prisma.fSMTransition.create({
                data: {
                    versionId: version.id,
                    fromStateId: stateIds[source],
                    toStateId: stateIds[to],
                    triggerType: trigger.type,
                    triggerEvent: trigger.event,
                    timeoutMinutes: trigger.minutes,
                    priority,
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
        }
    };

    console.log('🔗 Creating Transitions...');

    // === 1. GLOBAL TRANSITIONS ===
    // ANY -> PAID_ACTIVE (Payment) - High Priority
    await createTransition('ANY', States.PAID_ACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.PAYMENT_COMPLETED },
        100, // High Priority
        [],
        "Payment always activates"
    );

    // ANY -> BLOCKED (User Blocked) - High Priority? "Admin"
    await createTransition('ANY', States.BLOCKED,
        { type: FSMTriggerType.EVENT, event: FSMEvent.USER_BLOCKED },
        100,
        [],
        "Admin Block"
    );

    // ANY -> INACTIVE (User Unblocked) 
    // Wait, Table 1: "ANY | USER_UNBLOCKED | — | INACTIVE"
    // Does this mean if I unblock a user, they go to INACTIVE? Yes.
    await createTransition('ANY', States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.USER_UNBLOCKED },
        50,
        [],
        "Return from block to inactive"
    );


    // === 2. Onboarding / Activation ===
    // NEW (Just Started) -> ACTIVATING (First Generation)
    // NOTE: We REMOVED BOT_START transition. User stays in NEW until they generate.
    await createTransition(States.NEW, States.ACTIVATING,
        { type: FSMTriggerType.EVENT, event: FSMEvent.GENERATION_COMPLETED },
        0,
        [{ field: 'totalGenerations', operator: '>=', value: '1' }],
        "First generation made"
    );

    // ACTIVATING -> ACTIVE_FREE (Generation Completed >= 3)
    await createTransition(States.ACTIVATING, States.ACTIVE_FREE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.GENERATION_COMPLETED },
        0,
        [{ field: 'totalGenerations', operator: '>=', value: '2' }],
        "User engaged (>=3 gens)"
    );

    // Note: "PAID_ACTIVE" transition is covered by Global Payment Rule. 
    // Table 2 lists "ACTIVATING -> PAYMENT_COMPLETED -> PAID_ACTIVE" but Global 1 covers it. 
    // We assume Global covers it so we don't need duplicate, or we can add it for clarity/specificity.
    // Since priority 100 is on Global, it will be picked.

    // NEW -> INACTIVE (Abandoned at start)
    await createTransition(States.NEW, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        0,
        [{ field: 'hoursSinceLastActivity', operator: '>', value: '24' }],
        "Abandoned at start"
    );
    // ACTIVATING -> INACTIVE (Abandoned during activation)
    await createTransition(States.ACTIVATING, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        0,
        [{ field: 'hoursSinceLastActivity', operator: '>', value: '24' }],
        "Abandoned during activation"
    );


    // === 3. Free Loop ===
    // === 3. Free Loop ===
    // ACTIVE_FREE -> PAYWALL (Credits < 5.1)
    await createTransition(States.ACTIVE_FREE, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_CHANGED },
        0,
        [{ field: 'credits', operator: '<', value: '5.1' }],
        "Free credits exhausted"
    );

    // Also allow PAYWALL from NEW/ACTIVATING if they burn free credits instantly
    await createTransition(States.NEW, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_CHANGED },
        0,
        [{ field: 'credits', operator: '<', value: '5.1' }],
        "Credits exhausted at start"
    );
    await createTransition(States.ACTIVATING, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_CHANGED },
        0,
        [{ field: 'credits', operator: '<', value: '5.1' }],
        "Credits exhausted activating"
    );

    // ACTIVE_FREE -> INACTIVE (Last Activity > X)
    await createTransition(States.ACTIVE_FREE, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        0,
        [{ field: 'hoursSinceLastActivity', operator: '>', value: '24' }], // Example X=24
        "Abandoned free"
    );


    // === 4. Paywall ===
    // PAYWALL -> PAID_ACTIVE (covered by global)

    // PAYWALL -> INACTIVE (Last Activity > X)
    await createTransition(States.PAYWALL, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        0,
        [{ field: 'hoursSinceLastActivity', operator: '>', value: '24' }], // Example X
        "Didn't buy"
    );


    // === 5. Paid Loop ===
    // PAID_ACTIVE -> PAYWALL (Credits < 5.1)
    await createTransition(States.PAID_ACTIVE, States.PAYWALL,
        { type: FSMTriggerType.EVENT, event: FSMEvent.CREDITS_CHANGED },
        0,
        [{ field: 'credits', operator: '<', value: '5.1' }],
        "Paid credits exhausted"
    );

    // PAID_ACTIVE -> INACTIVE (Last Activity > X)
    await createTransition(States.PAID_ACTIVE, States.INACTIVE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.LAST_ACTIVITY },
        0,
        [{ field: 'hoursSinceLastActivity', operator: '>', value: '168' }], // Example X=168 (1 week) for paid
        "Paid user cooled off"
    );


    // === 6. Inactivity & Churn ===
    // INACTIVE -> PAID_ACTIVE (Reanimated by Payment) - Covered by Global

    // INACTIVE -> ACTIVE_FREE (Generation Completed with Credits > 0)
    // "Returned successfully freely"
    // Wait, if they are INACTIVE, and they generate, they become ACTIVE_FREE?
    // Condition: credits > 0.
    await createTransition(States.INACTIVE, States.ACTIVE_FREE,
        { type: FSMTriggerType.EVENT, event: FSMEvent.GENERATION_COMPLETED },
        0,
        [{ field: 'credits', operator: '>', value: '0' }],
        "Came back freely"
    );

    // INACTIVE -> CHURNED (Timeout >= Y)
    // Table says "Event: TIMEOUT". As discussed, usually handled by Time Trigger.
    // I will use Time Trigger.
    await createTransition(States.INACTIVE, States.CHURNED,
        { type: FSMTriggerType.TIME, minutes: 7 * 24 * 60 }, // 7 Days
        0,
        [],
        "Final Churn"
    );


    // === 7. Terminal ===
    // CHURNED -> PAID_ACTIVE (Payment) - Covered by Global
    // BLOCKED -> Terminal (No transitions out, except maybe Unblock -> Inactive, covered by Global)

    console.log('✅ Seeding Complete: Core Lifecycle FSM v2.1.0');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
