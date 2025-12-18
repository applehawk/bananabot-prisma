
import { PrismaClient, RuleTrigger, RuleActionType, RuleConditionOperator, OverlayType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding Rules Engine (Standard Rules)...');

    // 1. Cleanup Old Rules
    await prisma.ruleAction.deleteMany({});
    await prisma.ruleCondition.deleteMany({});
    await prisma.rule.deleteMany({});

    // Helper
    const createRule = async (
        code: string,
        trigger: RuleTrigger,
        priority: number,
        description: string,
        conditions: { field: string, operator: RuleConditionOperator, value?: string, groupId?: number }[],
        actions: { type: RuleActionType, params?: any, order?: number }[]
    ) => {
        await prisma.rule.create({
            data: {
                code,
                trigger,
                priority,
                description,
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
                        order: a.order || idx
                    }))
                }
            }
        });
        console.log(`✅ Rule Created: ${code}`);
    };

    console.log('--- 1. Lifecycle Rules (State-Based) ---');

    // LC-1: Welcome on Active (Bonus)
    await createRule(
        'LC-1-WELCOME',
        RuleTrigger.STATE_CHANGED,
        100,
        'Welcome Bonus on Active',
        [
            { field: 'to_state_name', operator: RuleConditionOperator.EQUALS, value: 'ACTIVE_FREE' }
        ],
        [
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.INFO, text: '🎉 Поздравляем! Вы теперь активный пользователь. Держите бонус!' }
            },
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.BONUS, amount: 10, hours: 24 }
            }
        ]
    );

    // LC-2: Paywall Tripwire
    // Replaces old TW-1/TW-1-GEN with robust FSM state check
    await createRule(
        'LC-2-TRIPWIRE',
        RuleTrigger.STATE_CHANGED,
        200, // High priority
        'Paywall Tripwire Activation',
        [
            { field: 'to_state_name', operator: RuleConditionOperator.EQUALS, value: 'PAYWALL' }
        ],
        [
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.INFO, text: '⚠️ Бесплатные генерации закончились!' }
            },
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.TRIPWIRE } }
        ]
    );

    // LC-3: Thank You Purchase
    await createRule(
        'LC-3-THANK',
        RuleTrigger.STATE_CHANGED,
        100,
        'Thank You for Purchase',
        [
            { field: 'to_state_name', operator: RuleConditionOperator.EQUALS, value: 'ACTIVE_PAID' }
        ],
        [
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.INFO, text: 'Спасибо за покупку! Вы теперь VIP 💎' }
            }
        ]
    );

    // LC-4: Inactivity Nudge
    await createRule(
        'LC-4-INACTIVE',
        RuleTrigger.STATE_CHANGED,
        100,
        'Inactivity Nudge',
        [
            { field: 'to_state_name', operator: RuleConditionOperator.EQUALS, value: 'INACTIVE' }
        ],
        [
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.INFO, text: 'Мы скучаем! 🥺' }
            }
        ]
    );

    // LC-5: Resurrection
    await createRule(
        'LC-5-RESURRECT',
        RuleTrigger.STATE_CHANGED,
        100,
        'Resurrection Welcome',
        [
            { field: 'to_state_name', operator: RuleConditionOperator.EQUALS, value: 'ACTIVE_FREE' },
            { field: 'trigger_event', operator: RuleConditionOperator.EQUALS, value: 'BOT_START' } // Only if manually started
        ],
        [
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.INFO, text: 'С возвращением!' }
            }
        ]
    );


    console.log('--- 2. Business Rules (Achievements & Utility) ---');

    // B-1: Milestone 10 Gens
    await createRule(
        'B-1-10GENS',
        RuleTrigger.GENERATION_COMPLETED,
        100,
        'Achievement: 10 Generations',
        [{ field: 'totalGenerations', operator: RuleConditionOperator.EQUALS, value: '10' }],
        [
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.INFO, text: '🏆 Достижение: 10 генераций! Вот вам 50 монет.' }
            },
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.BONUS, amount: 50, hours: 48 }
            }
        ]
    );

    // B-2: Milestone 50 Gens (Existing B-1)
    await createRule(
        'B-2-50GENS',
        RuleTrigger.GENERATION_COMPLETED,
        100,
        'Milestone Bonus (50 gens)',
        [
            { field: 'lifecycle', operator: RuleConditionOperator.EQUALS, value: 'PAID_ACTIVE', groupId: 1 },
            { field: 'isMilestone', operator: RuleConditionOperator.EQUALS, value: 'true', groupId: 1 }
        ],
        [
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: {
                    type: OverlayType.BONUS,
                    amount: 25,
                    reason: 'milestone_50'
                }
            }
        ]
    );

    // U-1: Expired Bonus Notification
    await createRule(
        'U-1-EXPIRED',
        RuleTrigger.OVERLAY_EXPIRED,
        50,
        'Notify Expired Bonus',
        [{ field: 'overlayType', operator: RuleConditionOperator.EQUALS, value: 'BONUS' }],
        [
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.INFO, text: '⏳ Ваш временный бонус сгорел.' }
            }
        ]
    );

    // U-2: Tripwire Expiration (Old TW-3)
    await createRule(
        'U-2-TW-EXPIRE',
        RuleTrigger.TIME,
        50,
        'Tripwire Expiration',
        [
            { field: 'overlay.TRIPWIRE', operator: RuleConditionOperator.EXISTS },
            { field: 'overlay.TRIPWIRE.state', operator: RuleConditionOperator.EQUALS, value: 'EXPIRED' }
        ],
        [
            { type: RuleActionType.DEACTIVATE_OVERLAY, params: { type: OverlayType.TRIPWIRE } }
        ]
    );

    // U-3: Tripwire Consume (Old TW-4)
    await createRule(
        'U-3-TW-CONSUME',
        RuleTrigger.PAYMENT_COMPLETED,
        100,
        'Tripwire Consumption',
        [
            { field: 'overlay.TRIPWIRE', operator: RuleConditionOperator.EXISTS }
        ],
        [
            { type: RuleActionType.DEACTIVATE_OVERLAY, params: { type: OverlayType.TRIPWIRE } }
        ]
    );

    console.log('--- 3. Special Offer Rules ---');

    // SO-1: Admin Push
    await createRule(
        'SO-1',
        RuleTrigger.ADMIN_EVENT,
        50,
        'Admin Push Offer',
        [
            { field: 'event.subType', operator: RuleConditionOperator.EQUALS, value: 'PUSH_OFFER' },
            { field: 'lifecycle', operator: RuleConditionOperator.IN, value: 'PAYWALL,INACTIVE' }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.SPECIAL_OFFER } }
        ]
    );

    console.log('--- 4. Referral Rules ---');

    // R-1: Enable on Payment
    await createRule(
        'R-1',
        RuleTrigger.PAYMENT_COMPLETED,
        100,
        'Referral Activation',
        [
            { field: 'lifecycle', operator: RuleConditionOperator.EQUALS, value: 'PAID_ACTIVE', groupId: 1 },
            { field: 'overlay.REFERRAL', operator: RuleConditionOperator.NOT_EXISTS, groupId: 1 }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.REFERRAL } }
        ]
    );

    // R-2: Invite
    await createRule(
        'R-2',
        RuleTrigger.REFERRAL_INVITE,
        100,
        'Referral Invite Handler',
        [
            { field: 'overlay.REFERRAL', operator: RuleConditionOperator.NOT_EXISTS }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.REFERRAL } }
        ]
    );

    // RET-1: Payment Failed
    await createRule(
        'RET-1',
        RuleTrigger.PAYMENT_FAILED,
        100,
        'Payment Retry Nudge',
        [
            { field: 'overlay.PAYMENT_RETRY', operator: RuleConditionOperator.NOT_EXISTS }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.INFO, overlayCode: 'PAYMENT_RETRY' } }
        ]
    );

    console.log('--- 5. Onboarding Rules ---');

    // ONB-1: Start -> Offer
    await createRule(
        'ONB-1',
        RuleTrigger.BOT_START,
        200,
        'Onboarding: Offer',
        [
            { field: 'overlay.ONBOARDING', operator: RuleConditionOperator.NOT_EXISTS }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.ONBOARDING, step: 'OFFER' } }
        ]
    );

    // ONB-2: Accepted -> Step 1
    await createRule(
        'ONB-2',
        RuleTrigger.ADMIN_EVENT,
        200,
        'Onboarding: Step 1',
        [
            { field: 'event.subType', operator: RuleConditionOperator.EQUALS, value: 'ONBOARDING_START' }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.ONBOARDING, step: 'STEP_1' } }
        ]
    );

    // ONB-3: First Gen -> Step 2
    await createRule(
        'ONB-3',
        RuleTrigger.GENERATION_COMPLETED,
        200,
        'Onboarding: Step 2',
        [
            { field: 'totalGenerations', operator: RuleConditionOperator.EQUALS, value: '1' },
            { field: 'overlay.ONBOARDING', operator: RuleConditionOperator.EXISTS }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.ONBOARDING, step: 'STEP_2' } }
        ]
    );

    // ONB-4: Image Uploaded -> Step 3
    await createRule(
        'ONB-4',
        RuleTrigger.GENERATION_REQUESTED,
        200,
        'Onboarding: Step 3',
        [
            { field: 'generation.type', operator: RuleConditionOperator.EQUALS, value: 'IMAGE_TO_IMAGE' },
            { field: 'overlay.ONBOARDING', operator: RuleConditionOperator.EXISTS },
            { field: 'overlay.ONBOARDING.metadata.step', operator: RuleConditionOperator.EQUALS, value: 'STEP_2' }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.ONBOARDING, step: 'STEP_3' } }
        ]
    );

    // ONB-5: Finish
    await createRule(
        'ONB-5',
        RuleTrigger.GENERATION_COMPLETED,
        200,
        'Onboarding: Finish',
        [
            { field: 'overlay.ONBOARDING', operator: RuleConditionOperator.EXISTS },
            { field: 'overlay.ONBOARDING.metadata.step', operator: RuleConditionOperator.EQUALS, value: 'STEP_3' }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.ONBOARDING, step: 'COMPLETED' } }
        ]
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
