
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
    const user = await prisma.user.findFirst({ where: { email: "owner@clinic.com" } });
    console.log(JSON.stringify(user, null, 2));
    process.exit(0);
}
run();
