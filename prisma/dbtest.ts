import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient({ log: ["query", "info", "warn", "error"] });

async function main() {
  console.log("Querying appointments one by one...");
  const apps = await prisma.appointment.findMany({ select: { id: true, appointmentCode: true } });
  console.log(`Found ${apps.length} appointments.`);
  
  for (const app of apps) {
    try {
      await prisma.appointment.findUnique({
        where: { id: app.id },
        include: {
          clinic: {
            include: { landingPage: true }
          }
        }
      });
      console.log(`✅ Appointment ${app.appointmentCode || app.id} succeeded!`);
    } catch (err: any) {
      console.error(`❌ Appointment ${app.appointmentCode || app.id} failed:`, err.message || err);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
