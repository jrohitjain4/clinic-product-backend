const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
prisma.doctor.findMany().then(r => fs.writeFileSync('test3.json', JSON.stringify(r))).finally(() => prisma.$disconnect());
