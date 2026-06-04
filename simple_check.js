const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany();
    console.log(users.map(u => ({ email: u.email, role: u.role })));
    process.exit(0);
}

check();
