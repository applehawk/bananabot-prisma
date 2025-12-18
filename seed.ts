import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'child_process';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Starting master seed...');

    try {
        console.log('👉 Running FSM Seed...');
        execSync('bun run prisma/seed-fsm.ts', { stdio: 'inherit' });

        console.log('👉 Running Overlays Seed...');
        execSync('bun run prisma/seed-overlays.ts', { stdio: 'inherit' });

        console.log('👉 Running Rules Seed...');
        execSync('bun run prisma/seed-rules.ts', { stdio: 'inherit' });

        console.log('✅ Master seed completed.');
    } catch (e) {
        console.error('❌ Master seed failed:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect()
    }
}

main();
