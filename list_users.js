const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function listUsers() {
    try {
        const users = await prisma.user.findMany({
            select: {
                email: true,
                fullName: true,
                role: true
            }
        });
        console.log("Users in DB:", JSON.stringify(users, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

listUsers();
