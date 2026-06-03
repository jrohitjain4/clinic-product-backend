import { PrismaClient } from "./prisma/generated/client";
const prisma = new PrismaClient();
async function run() {
    await prisma.subscriptionPackage.deleteMany({});
    await prisma.subscriptionPackage.create({
        data: {
            name: "Free Trial (3 Days)",
            price: 0,
            durationInDays: 3,
            maxDoctors: 1,
            maxPatients: 50,
            maxAppointments: 100,
            isActive: true,
        },
    });
    await prisma.subscriptionPackage.create({
        data: {
            name: "Standard Plan (Monthly)",
            price: 499,
            durationInDays: 30,
            maxDoctors: 5,
            maxPatients: 1000,
            maxAppointments: 2000,
            isActive: true,
        },
    });
    await prisma.subscriptionPackage.create({
        data: {
            name: "Premium Plan (Yearly)",
            price: 4999,
            durationInDays: 365,
            maxDoctors: 20,
            maxPatients: 9999,
            maxAppointments: 20000,
            isActive: true,
        },
    });
    console.log("Packages seeded");
    process.exit(0);
}
run();
