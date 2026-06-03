
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
    try {
        const appts = await prisma.appointment.findMany({
            include: { patient: true, doctor: true }
        });
        console.log(appts.length);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
