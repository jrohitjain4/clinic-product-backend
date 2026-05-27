const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find the user
    const user = await prisma.user.findUnique({
        where: { email: 'owner@clinic.com' }
    });

    if (!user) {
        console.log("User owner@clinic.com not found!");
        return;
    }

    if (!user.clinicId) {
        console.log("User is not associated with any clinic!");
        return;
    }

    // Find or create 'Pro Plan'
    let proPlan = await prisma.subscriptionPackage.findFirst({
        where: { name: { contains: 'Pro', mode: 'insensitive' } }
    });

    if (!proPlan) {
        proPlan = await prisma.subscriptionPackage.create({
            data: {
                name: 'Pro Plan',
                price: 99.99,
                durationInDays: 365,
                maxDoctors: 50,
                maxPatients: 10000,
                maxAppointments: 50000,
                isActive: true
            }
        });
        console.log("Created Pro Plan");
    }

    // Update clinic
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await prisma.clinic.update({
        where: { id: user.clinicId },
        data: {
            status: 'UPGRADED',
            packageId: proPlan.id,
            packageStartsAt: now,
            packageExpiresAt: expiresAt
        }
    });

    console.log("Successfully upgraded owner@clinic.com's clinic to Pro Plan!");
}

main()
    .catch(e => {
        console.error(e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
