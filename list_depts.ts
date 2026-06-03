
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
    const depts = await prisma.department.findMany({ include: { clinic: true } });
    console.log(JSON.stringify(depts, null, 2));
    process.exit(0);
}
run();
