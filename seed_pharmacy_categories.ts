import { PrismaClient } from "./prisma/generated/client";
const prisma = new PrismaClient();

async function main() {
  const clinics = await prisma.clinic.findMany({ select: { id: true, name: true } });
  console.log(`Found ${clinics.length} clinics`);

  const defaultCategories = [
    "Tablet",
    "Capsule",
    "Syrup",
    "Injection",
    "Drops",
    "Cream",
    "Ointment",
    "Powder",
    "Inhaler",
    "Medical Device",
  ];

  for (const clinic of clinics) {
    for (const name of defaultCategories) {
      const exists = await prisma.pharmacyCategory.findFirst({ where: { name, clinicId: clinic.id } });
      if (!exists) {
        await prisma.pharmacyCategory.create({ data: { name, clinicId: clinic.id, status: "Active" } });
        console.log(`✅ Created: "${name}" for clinic: ${clinic.name}`);
      } else {
        console.log(`ℹ️  Already exists: "${name}" for clinic: ${clinic.name}`);
      }
    }
  }

  const total = await prisma.pharmacyCategory.count();
  console.log(`\n✅ Done! Total pharmacy categories in DB: ${total}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
