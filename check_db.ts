
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
    const users = await prisma.user.count();
    const clinics = await prisma.clinic.count();
    const depts = await prisma.department.count();
    const doctors = await prisma.doctor.count();
    console.log({ users, clinics, depts, doctors });
    process.exit(0);
}
run();
