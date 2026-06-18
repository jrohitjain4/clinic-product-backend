import { PrismaClient } from "./prisma/generated/client";

const prisma = new PrismaClient();

async function main() {
  const clinic = await prisma.clinic.findFirst({
    where: { name: "Apollo Multispeciality Clinic" }
  });
  if (!clinic) {
    console.error("Clinic not found");
    return;
  }
  
  // Clean existing products first
  await prisma.product.deleteMany({
    where: { clinicId: clinic.id }
  });
  
  // Create realistic medicine products
  await prisma.product.createMany({
    data: [
      {
        name: "Paracetamol 650mg",
        description: "Fever and pain relief tablets",
        price: 150,
        key: "Medicine",
        clinicId: clinic.id
      },
      {
        name: "Amoxicillin 500mg",
        description: "Antibiotic capsules for infections",
        price: 250,
        key: "Medicine",
        clinicId: clinic.id
      },
      {
        name: "Cough Syrup 100ml",
        description: "Bronchial relief for sore throat and dry cough",
        price: 120,
        key: "Medicine",
        clinicId: clinic.id
      }
    ]
  });
  console.log("✅ Medicine products seeded successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
