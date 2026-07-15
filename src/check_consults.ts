import prisma from "./lib/prisma";

async function main() {
  const consults = await prisma.consultation.findMany({
    include: {
      appointment: true
    }
  });
  console.log("Consultations total count:", consults.length);
  consults.forEach(c => {
    console.log(`ID: ${c.id}, Code: ${c.consultationCode}, ApptId: ${c.appointmentId}, ApptCode: ${c.appointment?.appointmentCode}, ApptDate: ${c.appointment?.scheduledAt}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
