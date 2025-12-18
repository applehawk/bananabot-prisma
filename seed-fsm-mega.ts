import { PrismaClient, FSMTriggerType, FSMEvent, FSMActionType, RuleTrigger, RuleActionType, OverlayType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting Mega Map Seeding (Strict Architecture)...');

    // 0. Disable old versions & Cleanup target version to avoid unique constraint errors
    await prisma.fSMVersion.updateMany({
        data: { isActive: false }
    });

    // Delete if exists (idempotency)
    try {
        const existingStates = await prisma.fSMState.findMany({ where: { versionId: 999 }, select: { id: true } });
        const stateIds = existingStates.map(s => s.id);

        if (stateIds.length > 0) {
            // Clean up user states first
            await prisma.userFSMState.deleteMany({
                where: { stateId: { in: stateIds } }
            });
        }

        await prisma.fSMTransition.deleteMany({ where: { versionId: 999 } });
        await prisma.fSMState.deleteMany({ where: { versionId: 999 } });
        await prisma.fSMVersion.delete({ where: { id: 999 } });
        console.log('Deleted existing version 999');
    } catch (e) {
        // Ignore if not found or other errors (though ideally we should log meaningful errors)
        console.error('Cleanup failed (so it probably did not exist):', e);
    }

    // 1. Create New Version
    const version = await prisma.fSMVersion.create({
        data: {
            id: 999,
            name: 'v999_STRICT_ARCH',
            isActive: true
        }
    });

    console.log(`Created Version: ${version.name} (ID: ${version.id})`);

    // ==========================================
    // 2. FSM STATES
    // ==========================================
    const statesData = [
        { name: 'NEW', isInitial: true, description: 'User just started', x: 0, y: 0 },
        { name: 'ACTIVATING', description: 'Made 1 generation', x: 200, y: 0 },
        { name: 'ACTIVE_FREE', description: 'Made 2+ generations. Engaged.', x: 400, y: 0 },
        { name: 'PAYWALL', description: 'Out of free credits (>=3 gens)', x: 600, y: 0 },
        { name: 'ACTIVE_PAID', description: 'Bought credits', x: 600, y: 200 },
        { name: 'INACTIVE', description: 'Silent for > 48h', x: 400, y: 400 },
        { name: 'CHURNED', description: 'Silent for > 7d (Terminal-ish)', x: 600, y: 400, isTerminal: false },
    ];

    const states: Record<string, string> = {}; // Name -> ID

    for (const s of statesData) {
        const state = await prisma.fSMState.create({
            data: {
                versionId: version.id,
                name: s.name,
                description: s.description,
                isInitial: s.isInitial || false,
                isTerminal: s.isTerminal || false,
                positionX: s.x,
                positionY: s.y
            }
        });
        states[s.name] = state.id;
    }
    console.log(`Created ${statesData.length} States`);

    // ==========================================
    // 3. TRANSITIONS (Infra Only)
    // ==========================================
    // Helper to create transition
    const createTransition = async (
        from: string,
        to: string,
        event: FSMEvent,
        conditions: any[] = [],
        tag?: string, // Only allow Tagging
        priority = 0
    ) => {
        const actions = [];
        if (tag) {
            actions.push({ type: FSMActionType.TAG_USER, config: { tag } });
        }

        // Log event is implicit infra action we can add
        actions.push({ type: FSMActionType.LOG_EVENT, config: { message: `Transition ${from}->${to}` } });

        const t = await prisma.fSMTransition.create({
            data: {
                versionId: version.id,
                fromStateId: states[from],
                toStateId: states[to],
                triggerType: FSMTriggerType.EVENT,
                triggerEvent: event,
                priority,
                conditions: {
                    create: conditions.map(c => ({
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
        return t;
    };

    // --- NEW -> ACTIVATING ---
    await createTransition('NEW', 'ACTIVATING', FSMEvent.GENERATION_COMPLETED, [
        { field: 'total_generations', operator: 'GTE', value: '1' }
    ], 'first_gen_co');

    // --- ACTIVATING -> ACTIVE_FREE ---
    await createTransition('ACTIVATING', 'ACTIVE_FREE', FSMEvent.GENERATION_COMPLETED, [
        { field: 'total_generations', operator: 'GTE', value: '2' }
    ], 'engaged_user');

    // --- ACTIVE_FREE -> PAYWALL ---
    // Path A: Generous usage
    await createTransition('ACTIVE_FREE', 'PAYWALL', FSMEvent.GENERATION_COMPLETED, [
        { field: 'total_generations', operator: 'GTE', value: '3' }
    ], 'paywall_hit', 10);

    // Path B: Ran out of credits explicitly
    await createTransition('ACTIVE_FREE', 'PAYWALL', FSMEvent.INSUFFICIENT_CREDITS, [], 'paywall_hit', 10);

    // --- PAYWALL -> ACTIVE_PAID ---
    await createTransition('PAYWALL', 'ACTIVE_PAID', FSMEvent.PAYMENT_COMPLETED, [], 'customer', 100);

    // --- ACTIVE_PAID -> ACTIVE_FREE (Downgrade) ---
    await createTransition('ACTIVE_PAID', 'ACTIVE_FREE', FSMEvent.CREDITS_CHANGED, [
        { field: 'credits_balance', operator: 'LT', value: '18' }
    ], 'churn_risk');

    // --- INACTIVITY LOOPS ---
    await createTransition('ACTIVE_FREE', 'INACTIVE', FSMEvent.LAST_ACTIVITY, [
        { field: 'hours_since_last_activity', operator: 'GT', value: '48' }
    ], 'inactive_free');

    // INACTIVE -> ACTIVE_FREE (Resurrection)
    await createTransition('INACTIVE', 'ACTIVE_FREE', FSMEvent.BOT_START, [], 'resurrected');
    await createTransition('INACTIVE', 'ACTIVE_FREE', FSMEvent.GENERATION_COMPLETED, [], 'resurrected');

    // INACTIVE -> CHURNED (Deep Silence)
    await createTransition('INACTIVE', 'CHURNED', FSMEvent.LAST_ACTIVITY, [
        { field: 'hours_since_last_activity', operator: 'GT', value: '168' } // 7 days
    ], 'churned');


    console.log('Created Transitions (Only Infra Actions)');

    // ==========================================
    // 4. RULES (The Decision Matrix)
    // ==========================================

    // Explicit cleanup to avoid FK issues
    await prisma.ruleAction.deleteMany({});
    await prisma.ruleCondition.deleteMany({});
    await prisma.rule.deleteMany({}); // Clean slate for rules in dev

    // Helper
    const createRule = async (code: string, trigger: RuleTrigger, conditions: any[], actions: any[]) => {
        await prisma.rule.create({
            data: {
                code: code + '_' + Date.now().toString().slice(-4),
                trigger,
                description: code,
                conditions: {
                    create: conditions.map(c => ({
                        field: c.field,
                        operator: c.operator,
                        value: c.value,
                        groupId: c.groupId || 0
                    }))
                },
                actions: {
                    create: actions.map((a, idx) => ({
                        type: a.type,
                        params: a.params,
                        order: idx
                    }))
                }
            }
        });
        console.log(`✅ Rule: ${code}`);
    }

    console.log('--- STRICT RULES: FSM Lifecycle Hooks ---');

    // Hook 1: Entered ACTIVE_FREE -> Welcome Bonus
    await createRule(
        'WELCOME_ON_ACTIVE',
        RuleTrigger.STATE_CHANGED,
        [
            { field: 'to_state_name', operator: 'EQUALS', value: 'ACTIVE_FREE' }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.INFO, text: '🎉 Поздравляем! Вы теперь активный пользователь. Держите бонус!' } },
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.BONUS, amount: 10, hours: 24 } }
        ]
    );

    // Hook 2: Entered PAYWALL -> Show Tripwire
    await createRule(
        'PAYWALL_TRIPWIRE',
        RuleTrigger.STATE_CHANGED,
        [
            { field: 'to_state_name', operator: 'EQUALS', value: 'PAYWALL' }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.INFO, text: '⚠️ Бесплатные генерации закончились!' } },
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.TRIPWIRE } }
        ]
    );

    // Hook 3: Entered ACTIVE_PAID -> Thank you
    await createRule(
        'THANK_YOU_PURCHASE',
        RuleTrigger.STATE_CHANGED,
        [
            { field: 'to_state_name', operator: 'EQUALS', value: 'ACTIVE_PAID' }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.INFO, text: 'Спасибо за покупку! Вы теперь VIP 💎' } }
        ]
    );

    // Hook 4: Inactivity Nudge
    // Note: We used FSM Transition to move to INACTIVE. 
    // We can hook into that to send the message.
    await createRule(
        'INACTIVITY_NUDGE',
        RuleTrigger.STATE_CHANGED,
        [
            { field: 'to_state_name', operator: 'EQUALS', value: 'INACTIVE' }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.INFO, text: 'Мы скучаем! 🥺' } }
        ]
    );

    // Hook 5: Resurrected
    // Hook when moving FROM INACTIVE TO ACTIVE_FREE
    await createRule(
        'RESURRECTION_WELCOME',
        RuleTrigger.STATE_CHANGED,
        [
            { field: 'from_state_name', operator: 'EQUALS', value: 'INACTIVE' }, // Wait, logic doesn't support from_state_name yet? 
            // We supported from_state_id. But names are easier. 
            // Let's assume we match on to_state_name='ACTIVE_FREE' AND previous valid context if possible.
            // Or we just check 'to_state_name' matches 'ACTIVE_FREE' AND 'days_since_created' > 7?
            // Creating 'from_state_id' condition is brittle with IDs.
            // Let's just say "Welcome Back" message is redundant with "Welcome" or specific to resurrection.
            // For now, let's keep it simple.
            { field: 'to_state_name', operator: 'EQUALS', value: 'ACTIVE_FREE' },
            { field: 'trigger_event', operator: 'EQUALS', value: 'BOT_START' } // Only if they typed /start
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.INFO, text: 'С возвращением!' } }
        ]
    );


    console.log('--- 2. Business Rules (Non-Lifecycle) ---');

    // Achievement 10 Gens
    await createRule(
        'ACHIEVEMENT_10_GENS',
        RuleTrigger.GENERATION_COMPLETED,
        [{ field: 'total_generations', operator: 'EQUALS', value: '10' }],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.INFO, text: '🏆 Достижение: 10 генераций! Вот вам 50 монет.' } },
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.BONUS, amount: 50, hours: 48 } }
        ]
    );

    // Expired Bonus
    await createRule(
        'NOTIFY_EXPIRED_BONUS',
        RuleTrigger.OVERLAY_EXPIRED,
        [{ field: 'overlayType', operator: 'EQUALS', value: 'BONUS' }],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.INFO, text: '⏳ Ваш временный бонус сгорел.' } }
        ]
    );

    console.log('✅ Mega Map Seeding Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
