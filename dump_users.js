const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function dump() {
    const users = await prisma.user.findMany({
        select: { email: true, role: true, phone: true, username: true }
    });
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
}

dump();
