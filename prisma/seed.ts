import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  // Clear existing database records
  await prisma.user.deleteMany({});
  await prisma.clinic.deleteMany({});
  await prisma.subscriptionPackage.deleteMany({});

  // Hash passwords
  const superAdminPasswordHash = await bcrypt.hash("superadmin123", 10);
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const doctorPasswordHash = await bcrypt.hash("doctor123", 10);
  const patientPasswordHash = await bcrypt.hash("patient123", 10);
  const porterPasswordHash = await bcrypt.hash("porter123", 10);

  // 1. Create Super Admin (Global platform administrator - no clinic associated)
  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@clinic.com",
      fullName: "Global Super Admin",
      passwordHash: superAdminPasswordHash,
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`Created Super Admin: ${superAdmin.email}`);

  // 1a. Create default Subscription Packages
  const freeTrialPackage = await prisma.subscriptionPackage.create({
    data: {
      name: "3 Days Free Trial",
      price: 0,
      durationInDays: 3,
      maxDoctors: 5,
      maxPatients: 50,
      maxAppointments: 100,
      isActive: true,
    },
  });
  console.log(`Created Package: ${freeTrialPackage.name}`);

  const standardPackage = await prisma.subscriptionPackage.create({
    data: {
      name: "Standard Plan (Monthly)",
      price: 49.99,
      durationInDays: 30,
      maxDoctors: 10,
      maxPatients: 500,
      maxAppointments: 1000,
      isActive: true,
    },
  });
  console.log(`Created Package: ${standardPackage.name}`);

  const proPackage = await prisma.subscriptionPackage.create({
    data: {
      name: "Professional Plan (Yearly)",
      price: 499.00,
      durationInDays: 365,
      maxDoctors: 50,
      maxPatients: 5000,
      maxAppointments: 10000,
      isActive: true,
    },
  });
  console.log(`Created Package: ${proPackage.name}`);

  // 2. Create a default Clinic (Tenant)
  const preclinicCenter = await prisma.clinic.create({
    data: {
      name: "Preclinic Medical Center",
      subdomain: "preclinic",
      address: "123 Healthcare Boulevard, Medical District",
      phone: "+1 (555) 019-2834",
      packageId: freeTrialPackage.id,
      packageStartsAt: new Date(),
      packageExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    },
  });
  console.log(`Created Tenant Clinic: ${preclinicCenter.name} (${preclinicCenter.subdomain})`);

  // 3. Create Admin / Clinic Owner
  const admin = await prisma.user.create({
    data: {
      email: "admin@clinic.com",
      fullName: "Preclinic Administrator",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      clinicId: preclinicCenter.id,
    },
  });
  console.log(`Created Clinic Admin: ${admin.email}`);

  // 4. Create Doctor
  const doctor = await prisma.user.create({
    data: {
      email: "doctor@clinic.com",
      fullName: "Dr. Sarah Connor",
      passwordHash: doctorPasswordHash,
      role: Role.DOCTOR,
      clinicId: preclinicCenter.id,
    },
  });
  console.log(`Created Doctor: ${doctor.email}`);

  // 5. Create Patient
  const patient = await prisma.user.create({
    data: {
      email: "patient@clinic.com",
      fullName: "John Doe",
      passwordHash: patientPasswordHash,
      role: Role.PATIENT,
      clinicId: preclinicCenter.id,
    },
  });
  console.log(`Created Patient: ${patient.email}`);

  // 6. Create Porter (Staff)
  const porter = await prisma.user.create({
    data: {
      email: "porter@clinic.com",
      fullName: "James Porter",
      passwordHash: porterPasswordHash,
      role: Role.PORTER,
      clinicId: preclinicCenter.id,
    },
  });
  console.log(`Created Porter (Staff): ${porter.email}`);

  console.log("Seeding complete! Initial accounts loaded successfully:");
  console.log("--------------------------------------------------");
  console.log("Super Admin:  superadmin@clinic.com | superadmin123");
  console.log("Clinic Admin: admin@clinic.com      | admin123");
  console.log("Doctor:       doctor@clinic.com     | doctor123");
  console.log("Patient:      patient@clinic.com    | patient123");
  console.log("Porter:       porter@clinic.com     | porter123");
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
