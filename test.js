const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.attendance.findMany().then(r => console.log(JSON.stringify(r))).finally(() => prisma.$disconnect());
