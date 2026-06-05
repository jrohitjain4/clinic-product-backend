const { PrismaClient } = require("./prisma/generated/client");
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                username: true,
                role: true
            }
        });
        console.log("USERS:", JSON.stringify(users, null, 2));
    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
