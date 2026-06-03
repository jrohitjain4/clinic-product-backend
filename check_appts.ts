
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
    const appts = await prisma.appointment.findMany({
        where: {
            patient: { firstName: { contains: "Gaurav" } },
        },
        include: { patient: true, doctor: true }
    });
    console.log(JSON.stringify(appts.map(a => ({
        id: a.id,
        patient: a.patient.firstName,
        doctor: a.doctor.fullName,
        status: a.status,
        scheduledAt: a.scheduledAt
    })), null, 2));
    process.exit(0);
}
run();
