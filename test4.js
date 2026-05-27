const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
prisma.holiday.findMany().then(r => fs.writeFileSync('test4.json', JSON.stringify(r))).finally(() => prisma.$disconnect());
