const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
    const doctors = await prisma.doctor.findMany();
    console.log(doctors.map(d => ({ email: d.email, fullName: d.fullName })));
    process.exit(0);
}

check();
