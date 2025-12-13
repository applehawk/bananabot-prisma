import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = 'admin';
    const password = 'password';

    console.log(`🌱 Seeding admin user: ${username}...`);

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.adminUser.upsert({
        where: { username },
        update: {}, // Don't overwrite if exists, or maybe we want to reset password? For now, keep as is.
        create: {
            username,
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    console.log(`✅ Admin user ready: ${admin.username}`);
}

main()
    .catch((e) => {
        console.error('❌ Error seeding admin:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
