
import { PrismaClient, RuleTrigger, RuleActionType, RuleConditionOperator, OverlayType } from '@prisma/client';

const prisma = new PrismaClient();

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

    console.log('--- 1. Tripwire Rules ---');

    // TW-1: Eligibility (Credits Changed -> Paywall, No Payments, No Tripwire)
    await createRule(
        'TW-1',
        RuleTrigger.CREDITS_CHANGED,
        100,
        'Tripwire Eligibility Check',
        [
            { field: 'lifecycle', operator: RuleConditionOperator.EQUALS, value: 'PAYWALL' },
            { field: 'totalPayments', operator: RuleConditionOperator.EQUALS, value: '0' },
            { field: 'overlay.TRIPWIRE', operator: RuleConditionOperator.NOT_EXISTS }
        ],
        [
            {
                type: RuleActionType.ACTIVATE_OVERLAY,
                params: { type: OverlayType.TRIPWIRE, ttlHours: 24 }
            }
        ]
    );

    // TW-2: Show (Overlay Activated -> Send Offer)
    await createRule(
        'TW-2',
        RuleTrigger.OVERLAY_ACTIVATED,
        100,
        'Tripwire Show UI',
        [
            { field: 'overlay.type', operator: RuleConditionOperator.EQUALS, value: OverlayType.TRIPWIRE }
        ],
        [
            { type: RuleActionType.SEND_SPECIAL_OFFER, params: { offerId: 'tripwire_v1' } }
        ]
    );

    // TW-3: Expire (Time -> Deactivate)
    // Note: Assuming "overlay(TRIPWIRE).expired" condition logic is handled by the evaluator checking expiration times
    await createRule(
        'TW-3',
        RuleTrigger.TIME,
        50,
        'Tripwire Expiration',
        [
            { field: 'overlay.TRIPWIRE', operator: RuleConditionOperator.EXISTS },
            // "expired" is usually a state check or time check. 
            // We represent "overlay(TRIPWIRE).expired" as a specific field check if our engine supports it.
            // Or we rely on the engine passing expired items.
            { field: 'overlay.TRIPWIRE.isExpired', operator: RuleConditionOperator.EQUALS, value: 'true' }
        ],
        [
            { type: RuleActionType.DEACTIVATE_OVERLAY, params: { type: OverlayType.TRIPWIRE } }
        ]
    );

    // TW-4: Consume (Payment -> Deactivate)
    await createRule(
        'TW-4',
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


    console.log('--- 2. Bonus Rules ---');

    // B-1: Grant Admin
    await createRule(
        'B-1',
        RuleTrigger.ADMIN_EVENT, // Mapping ADMIN_BONUS_GRANTED to ADMIN_EVENT
        100,
        'Admin Bonus Grant',
        [
            // Usually implicit by event payload, but rules engine might filter
            { field: 'event.subType', operator: RuleConditionOperator.EQUALS, value: 'BONUS_GRANT' }
        ],
        [
            { type: RuleActionType.GRANT_BONUS, params: { source: 'admin' } } // Params usually come from event context
        ]
    );

    // B-2: Streak (Skipping specific implementation detail as it needs external trigger STREAK_REACHED)
    // Assuming generated event via custom trigger

    // B-3: Burn First
    await createRule(
        'B-3',
        RuleTrigger.GENERATION_REQUESTED,
        100,
        'Burn Bonus Credits First',
        [
            { field: 'bonusCredits', operator: RuleConditionOperator.GT, value: '0' }
        ],
        [
            // Custom action or specific param
            { type: RuleActionType.NO_ACTION, params: { strategy: 'burn_first' } }
            // In reality, this might be hardcoded in service, but rule can flag it.
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

    // SO-2: Show
    await createRule(
        'SO-2',
        RuleTrigger.OVERLAY_ACTIVATED,
        50,
        'Show Special Offer',
        [
            { field: 'overlay.type', operator: RuleConditionOperator.EQUALS, value: OverlayType.SPECIAL_OFFER }
        ],
        [
            { type: RuleActionType.SEND_MESSAGE, params: { template: 'special_offer_msg' } }
        ]
    );


    console.log('--- 4. Referral Rules ---');

    // R-1: Invite
    await createRule(
        'R-1',
        RuleTrigger.REFERRAL_INVITE,
        100,
        'Referral Activation',
        [
            { field: 'overlay.REFERRAL', operator: RuleConditionOperator.NOT_EXISTS }
        ],
        [
            { type: RuleActionType.ACTIVATE_OVERLAY, params: { type: OverlayType.REFERRAL } }
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
