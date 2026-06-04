const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
    const types = await prisma.leaveType.findMany();
    console.log("Leave Types:", JSON.stringify(types, null, 2));
    process.exit(0);
}

check();
