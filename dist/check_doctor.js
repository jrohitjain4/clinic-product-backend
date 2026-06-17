"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("Checking doctors in database...");
    const doctors = await prisma.doctor.findMany({
        select: {
            id: true,
            fullName: true,
            schedules: true,
            appointmentDuration: true
        }
    });
    console.log("Doctors found:", JSON.stringify(doctors, null, 2));
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
