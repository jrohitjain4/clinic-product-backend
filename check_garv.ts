
import { PrismaClient } from "./prisma/generated/client";
const prisma = new PrismaClient();
async function run() {
    const d = await prisma.doctor.findFirst({ where: { fullName: { contains: 'Garv' } } });
    console.log(JSON.stringify(d, null, 2));
    process.exit(0);
}
run();
