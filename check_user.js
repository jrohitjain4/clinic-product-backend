const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkUser() {
    try {
        const email = "rohitjain5900@gmail.com";
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { phone: email },
                    { username: email }
                ]
            }
        });
        console.log("User found:", JSON.stringify(user, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

checkUser();
