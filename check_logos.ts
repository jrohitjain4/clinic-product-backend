import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  console.log("Fetching landing page logos from database...");
  const landingPages = await prisma.landingPage.findMany({
    select: {
      id: true,
      clinicId: true,
      logo: true,
    }
  });

  console.log(`Found ${landingPages.length} landing pages.`);

  for (const lp of landingPages) {
    if (lp.logo) {
      console.log(`Landing Page ${lp.id} (Clinic ${lp.clinicId}): Logo length = ${lp.logo.length}`);
      if (lp.logo.startsWith("data:image")) {
        console.log(`-> Logo is a base64 data URL. Cleaning it up...`);
        await prisma.landingPage.update({
          where: { id: lp.id },
          data: { logo: null }
        });
        console.log(`-> Cleaned landing page ${lp.id}`);
      } else {
        console.log(`-> Logo is a normal string: "${lp.logo}"`);
      }
    } else {
      console.log(`Landing Page ${lp.id} (Clinic ${lp.clinicId}): Logo is null/empty`);
    }
  }

  // Also let's check if there are other base64 images in User or Doctor profileImages or signatures
  console.log("\nChecking User profile images...");
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true }
  });
  console.log(`Found ${users.length} users.`);

  // Let's also check Doctor profile image and signature
  console.log("\nChecking Doctor profile and signature images...");
  const doctors = await prisma.doctor.findMany({
    select: { id: true, fullName: true, profileImage: true, signatureImage: true }
  });
  for (const doc of doctors) {
    if (doc.profileImage && doc.profileImage.startsWith("data:image")) {
      console.log(`Doctor ${doc.fullName} profileImage is base64. Cleaning...`);
      await prisma.doctor.update({
        where: { id: doc.id },
        data: { profileImage: null }
      });
    }
    if (doc.signatureImage && doc.signatureImage.startsWith("data:image")) {
      console.log(`Doctor ${doc.fullName} signatureImage is base64. Cleaning...`);
      await prisma.doctor.update({
        where: { id: doc.id },
        data: { signatureImage: null }
      });
    }
  }

  console.log("\nInspection and cleanup complete.");
  process.exit(0);
}

run().catch(err => {
  console.error("Error executing script:", err);
  process.exit(1);
});
