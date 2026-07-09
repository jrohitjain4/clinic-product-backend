import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Querying prescriptions...");
  const prescriptions = await prisma.prescription.findMany({
    select: {
      id: true,
      prescriptionCode: true,
      appointmentId: true,
      patientId: true,
      doctorId: true,
      createdAt: true,
      medicines: {
        select: {
          medicineName: true
        }
      }
    }
  });
  console.log("ALL PRESCRIPTIONS IN DB:");
  console.log(JSON.stringify(prescriptions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
