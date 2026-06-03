
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
    try {
        const cols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'Doctor'`;
        console.log(cols);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
