const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
prisma.attendance.findMany().then(r => fs.writeFileSync('dump2.json', JSON.stringify(r))).finally(() => prisma.$disconnect());
