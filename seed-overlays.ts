
import { PrismaClient, OverlayType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding Overlay Engine Registry...');

    // 1. Cleanup
    await prisma.overlayVariant.deleteMany({});
    await prisma.overlay.deleteMany({});

    // Helper
    const createOverlay = async (
        code: string,
        type: OverlayType,
        priority: number,
        payload: any,
        options: { ttl?: number, cooldown?: number, maxImpressions?: number } = {}
    ) => {
        await prisma.overlay.create({
            data: {
                code,
                type,
                priority,
                isActive: true,
                ttlSeconds: options.ttl,
                cooldownSeconds: options.cooldown,
                maxImpressions: options.maxImpressions,
                payload
            }
        });
        console.log(`✅ Overlay Created: ${code}`);
    };

    // --- 1. TRIPWIRE ---
    // Template needs: itemName, itemPrice, itemCredits, paymentUrl
    await createOverlay(
        'TRIPWIRE_DEFAULT',
        OverlayType.TRIPWIRE,
        10,
        {
            message: {
                text: "<b>⚠️ Недостаточно кредитов!</b>\n\n" +
                    "Но для новичков у нас есть спецпредложение!\n" +
                    "<b>{{packageName}}</b>: {{credits}} монет всего за <b>{{price}} рублей</b>.\n" +
                    "Хватит на ~50 генераций!",
                parseMode: "HTML"
            },
            buttons: [
                { text: "❌ Отмена", action: "DISMISS" }, // DISMISS action handled by processor as hide or callback?
                { text: "🚀 Купить старт за {{price}}₽", url: "{{paymentUrl}}", action: "PAY" },
            ]
        },
        { ttl: 86400, cooldown: 3600 }
    );

    // --- 2. BONUS ---
    // Template: amount, reason
    await createOverlay(
        'BONUS_DEFAULT',
        OverlayType.BONUS,
        5,
        {
            message: {
                text: "🎁 <b>Вам начислен бонус!</b>\n\n" +
                    "Вы получили <b>{{amount}} монет</b>!\n" +
                    "Причина: {{reason}}\n" +
                    "Успейте потратить за {{hours}} часов!",
                parseMode: "HTML"
            },
            buttons: [
                { text: "🔥 Потратить сейчас", action: "menu_main" }
            ]
        },
        { ttl: 21600 } // 6h default
    );

    // --- 3. REFERRAL ---
    // Template: referralCode
    await createOverlay(
        'REFERRAL_DEFAULT',
        OverlayType.REFERRAL,
        5,
        {
            message: {
                text: "🤝 <b>Реферальная программа активирована!</b>\n\n" +
                    "Приглашайте друзей и получайте бонусы!\n" +
                    "Ваша ссылка: https://t.me/banana_bot?start={{referralCode}}",
                parseMode: "HTML"
            },
            buttons: [
                // Note: Telegram Share URL needs separate handling or client-side link mostly.
                // We can provide a button that opens share url?
                // https://t.me/share/url?url=...
                { text: "Пригласить друга 🗣", url: "https://t.me/share/url?url=https://t.me/banana_bot?start={{referralCode}}&text=Check%20this%20bot!", action: "SHARE" }
            ]
        }
    );

    // --- 4. ONBOARDING TRACK ---

    // ONBOARDING_OFFER
    await createOverlay(
        'ONBOARDING_OFFER',
        OverlayType.ONBOARDING,
        20,
        {
            message: {
                text: "👋 <b>Добро пожаловать!</b>\n\nВы хотите пройти небольшое обучение, чтобы стать мастером генераций?",
                parseMode: "HTML"
            },
            buttons: [
                { text: "✅ Да, хочу научиться!", action: "onboarding_start" },
                { text: "Нет, я уже умею", action: "onboarding_skip" }
            ]
        }
    );

    // ONBOARDING_STEP_1
    await createOverlay(
        'ONBOARDING_STEP_1',
        OverlayType.ONBOARDING,
        20,
        {
            message: {
                text: "🎓 <b>Обучение: Шаг 1</b>\n\n" +
                    "Всё просто! Напишите любой запрос в чат (например: \"Рыжий кот в космосе\") и я создам изображение.",
                parseMode: "HTML"
            },
            buttons: [
                { text: "❌ Закончить обучение", action: "onboarding_skip" }
            ]
        }
    );

    // ONBOARDING_STEP_2
    await createOverlay(
        'ONBOARDING_STEP_2',
        OverlayType.ONBOARDING,
        20,
        {
            message: {
                text: "🎉 <b>Отлично получилось!</b>\n\n" +
                    "Теперь попробуем генерацию с референсом. Пришлите мне любую картинку.",
                parseMode: "HTML"
            },
            buttons: [
                { text: "❌ Закончить обучение", action: "onboarding_skip" }
            ]
        }
    );

    // ONBOARDING_STEP_3
    await createOverlay(
        'ONBOARDING_STEP_3',
        OverlayType.ONBOARDING,
        20,
        {
            message: {
                text: "📸 <b>Картинка получена!</b>\n\n" +
                    "Теперь нажмите кнопку <b>Сгенерировать</b> в меню или напишите промпт, чтобы использовать эту картинку как основу.",
                parseMode: "HTML"
            },
            buttons: [
                { text: "❌ Закончить обучение", action: "onboarding_skip" }
            ]
        }
    );

    // ONBOARDING_COMPLETED
    await createOverlay(
        'ONBOARDING_COMPLETED',
        OverlayType.ONBOARDING,
        20,
        {
            message: {
                text: "🏆 <b>Поздравляем!</b>\n\n" +
                    "Вы прошли обучение и получили <b>20 бонусных монет</b>! Приятного творчества!",
                parseMode: "HTML"
            },
            buttons: [
                { text: "🚀 Начать творить", action: "menu_main" }
            ]
        }
    );

    // --- 5. PAYMENT RETRY ---
    // Only show once per user (maxImpressions: 1)
    await createOverlay(
        'PAYMENT_RETRY',
        OverlayType.INFO,
        100, // High priority
        {
            message: {
                text: "<b>🚫 Оплата не прошла</b>\n\n" +
                    "Кажется, возникла ошибка при оплате. Не переживайте, средства не были списаны.\n\n" +
                    "Попробуйте еще раз или выберите другой способ оплаты.",
                parseMode: "HTML"
            },
            buttons: [
                { text: "🔄 Попробовать еще раз", action: "PAY_RETRY" }, // Handler needs to reopen payment? Or just dismiss to let them try?
                { text: "💬 Написать в поддержку", url: "https://t.me/banana_support", action: "LINK" }
            ]
        },
        { maxImpressions: 1, ttl: 3600 }
    );

    console.log('✅ Seeding Complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
