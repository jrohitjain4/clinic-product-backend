import prisma from "./lib/prisma";

async function main() {
  const doctor = await prisma.doctor.findFirst({
    where: { fullName: "ddfghjukilop" }
  });
  console.log("Doctor: ", JSON.stringify(doctor, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
