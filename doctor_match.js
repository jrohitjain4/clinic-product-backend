const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const doctors = await prisma.doctor.findMany({ select: { email: true, fullName: true } });
    doctors.forEach(d => console.log(`${d.fullName}: ${d.email}`));
    process.exit(0);
}

main();
