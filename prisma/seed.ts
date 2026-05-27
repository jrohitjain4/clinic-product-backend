import { PrismaClient, Role, ClinicStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding (local)...");

  // Clear in FK-safe order
  await prisma.appointment.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.staff.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.designation.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.clinic.deleteMany({});
  await prisma.subscriptionPackage.deleteMany({});

  const hash = (pw: string) => bcrypt.hash(pw, 10);

  const [
    superAdminPasswordHash,
    ownerPasswordHash,
    adminPasswordHash,
    doctorPasswordHash,
    patientPasswordHash,
    porterPasswordHash,
  ] = await Promise.all([
    hash("superadmin123"),
    hash("owner123"),
    hash("admin123"),
    hash("doctor123"),
    hash("patient123"),
    hash("porter123"),
  ]);

  // Packages
  const freeTrialPackage = await prisma.subscriptionPackage.create({
    data: {
      name: "3 Days Free Trial",
      price: 0,
      durationInDays: 3,
      maxDoctors: 10,
      maxPatients: 100,
      maxAppointments: 200,
      isActive: true,
    },
  });

  await prisma.subscriptionPackage.create({
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

  const trialEnds = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  // Clinic on free trial
  const clinic = await prisma.clinic.create({
    data: {
      name: "Preclinic Medical Center",
      subdomain: "preclinic",
      address: "123 Healthcare Boulevard, Medical District",
      phone: "+1 (555) 019-2834",
      status: ClinicStatus.TRIAL,
      packageId: freeTrialPackage.id,
      packageStartsAt: new Date(),
      packageExpiresAt: trialEnds,
    },
  });
  console.log(`Clinic: ${clinic.name} | status=TRIAL | trial until ${trialEnds.toISOString()}`);

  // Users
  await prisma.user.create({
    data: {
      email: "superadmin@clinic.com",
      fullName: "Global Super Admin",
      passwordHash: superAdminPasswordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: "owner@clinic.com",
      fullName: "Rohit Jain (Clinic Owner)",
      passwordHash: ownerPasswordHash,
      role: Role.ADMIN,
      clinicId: clinic.id,
    },
  });
  console.log(`Clinic Owner: ${owner.email} / owner123`);

  await prisma.user.create({
    data: {
      email: "admin@clinic.com",
      fullName: "Preclinic Administrator",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      clinicId: clinic.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "doctor@clinic.com",
      fullName: "Dr. Sarah Connor",
      passwordHash: doctorPasswordHash,
      role: Role.DOCTOR,
      clinicId: clinic.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "patient@clinic.com",
      fullName: "John Doe",
      passwordHash: patientPasswordHash,
      role: Role.PATIENT,
      clinicId: clinic.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "porter@clinic.com",
      fullName: "James Porter",
      passwordHash: porterPasswordHash,
      role: Role.PORTER,
      clinicId: clinic.id,
    },
  });

  // Departments
  const nursingDept = await prisma.department.create({
    data: {
      name: "Nursing",
      description: "Nursing & patient care",
      clinicId: clinic.id,
      status: "Active",
    },
  });

  const cardiologyDept = await prisma.department.create({
    data: {
      name: "Cardiology",
      description: "Heart care unit",
      clinicId: clinic.id,
      status: "Active",
    },
  });

  const orthopedicsDept = await prisma.department.create({
    data: {
      name: "Orthopedics",
      description: "Bone and joint care",
      clinicId: clinic.id,
      status: "Active",
    },
  });

  // Designations — Doctor
  const seniorDoctorDesig = await prisma.designation.create({
    data: {
      name: "Senior Doctor",
      type: "Doctor",
      departmentId: nursingDept.id,
      clinicId: clinic.id,
      status: "Active",
    },
  });

  const cardiologistDesig = await prisma.designation.create({
    data: {
      name: "Cardiologist",
      type: "Doctor",
      departmentId: cardiologyDept.id,
      clinicId: clinic.id,
      status: "Active",
    },
  });

  const orthopedicDesig = await prisma.designation.create({
    data: {
      name: "Orthopedic Surgeon",
      type: "Doctor",
      departmentId: orthopedicsDept.id,
      clinicId: clinic.id,
      status: "Active",
    },
  });

  // Designations — Staff
  const frontOfficerDesig = await prisma.designation.create({
    data: {
      name: "Front Officer",
      type: "Staff",
      departmentId: nursingDept.id,
      clinicId: clinic.id,
      status: "Active",
    },
  });

  const adminOfficerDesig = await prisma.designation.create({
    data: {
      name: "Admin Officer",
      type: "Staff",
      departmentId: nursingDept.id,
      clinicId: clinic.id,
      status: "Active",
    },
  });

  const nurseDesig = await prisma.designation.create({
    data: {
      name: "Staff Nurse",
      type: "Staff",
      departmentId: nursingDept.id,
      clinicId: clinic.id,
      status: "Active",
    },
  });

  const defaultSchedule = {
    Monday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Tuesday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Wednesday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Thursday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Friday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
  };

  // Doctor profiles (clinic module)
  await prisma.doctor.create({
    data: {
      fullName: "Dr. Sarah Connor",
      email: "doctor@clinic.com",
      phone: "+1 54546 45648",
      departmentId: cardiologyDept.id,
      designationId: cardiologistDesig.id,
      medicalLicenseNumber: "ML-100001",
      yearOfExperience: 12,
      consultationCharge: 499,
      appointmentDuration: 30,
      languagesSpoken: ["English"],
      bloodGroup: "O+",
      gender: "Female",
      bio: "Experienced cardiologist.",
      status: "Active",
      clinicId: clinic.id,
      schedules: defaultSchedule,
    },
  });

  await prisma.doctor.create({
    data: {
      fullName: "Dr. Rohit Jain",
      email: "rohit.doctor@clinic.com",
      phone: "+1 41245 54132",
      departmentId: nursingDept.id,
      designationId: seniorDoctorDesig.id,
      medicalLicenseNumber: "ML-100002",
      yearOfExperience: 8,
      consultationCharge: 500,
      appointmentDuration: 30,
      languagesSpoken: ["English", "Hindi"],
      bloodGroup: "B+",
      gender: "Male",
      bio: "General physician.",
      status: "Active",
      clinicId: clinic.id,
      schedules: defaultSchedule,
    },
  });

  await prisma.doctor.create({
    data: {
      fullName: "Dr. Adam Milne",
      email: "adam@clinic.com",
      phone: "+1 54554 54789",
      departmentId: orthopedicsDept.id,
      designationId: orthopedicDesig.id,
      medicalLicenseNumber: "ML-100003",
      yearOfExperience: 15,
      consultationCharge: 450,
      appointmentDuration: 30,
      status: "Active",
      clinicId: clinic.id,
    },
  });

  console.log("Created 3 doctors");

  // HRM Staff records
  await prisma.staff.create({
    data: {
      staffCode: "STF001",
      fullName: "James Porter",
      role: "Reception",
      designationId: frontOfficerDesig.id,
      departmentId: nursingDept.id,
      email: "porter@clinic.com",
      phone: "+1 54546 45648",
      gender: "Male",
      bloodGroup: "A+",
      status: "Active",
      clinicId: clinic.id,
      dateOfJoining: new Date(),
    },
  });

  await prisma.staff.create({
    data: {
      staffCode: "STF002",
      fullName: "Priya Sharma",
      role: "Nurse",
      designationId: nurseDesig.id,
      departmentId: nursingDept.id,
      email: "priya@clinic.com",
      phone: "+1 41245 54132",
      gender: "Female",
      bloodGroup: "O+",
      status: "Active",
      clinicId: clinic.id,
      dateOfJoining: new Date(),
    },
  });

  await prisma.staff.create({
    data: {
      staffCode: "STF003",
      fullName: "Rohit Admin",
      role: "Front Desk",
      designationId: adminOfficerDesig.id,
      departmentId: nursingDept.id,
      email: "staff.admin@clinic.com",
      phone: "+1 43554 54985",
      gender: "Male",
      status: "Active",
      clinicId: clinic.id,
      dateOfJoining: new Date(),
    },
  });

  console.log("Created 3 staff members");

  const doctors = await prisma.doctor.findMany({
    where: { clinicId: clinic.id },
    orderBy: { createdAt: "asc" },
  });
  const [doc1, doc2, doc3] = doctors;

  const patientSeed = [
    {
      patientCode: "PT001",
      firstName: "Alberto",
      lastName: "Ripley",
      email: "alberto@example.com",
      phone: "+1 41245 54132",
      gender: "Male",
      bloodGroup: "O+",
      status: "Active",
      city: "Miami",
      state: "Florida",
      country: "USA",
      address1: "4150 Hiney Road",
      pincode: "33101",
      lastVisitedAt: new Date("2025-04-30"),
      primaryDoctorId: doc1?.id,
    },
    {
      patientCode: "PT002",
      firstName: "Susan",
      lastName: "Babin",
      email: "susan@example.com",
      phone: "+1 54554 54789",
      gender: "Female",
      bloodGroup: "A+",
      status: "Inactive",
      city: "Austin",
      state: "Texas",
      country: "USA",
      address1: "12 Oak Street",
      pincode: "73301",
      lastVisitedAt: new Date("2025-04-15"),
      primaryDoctorId: doc2?.id ?? doc1?.id,
    },
    {
      patientCode: "PT003",
      firstName: "Carol",
      lastName: "Lam",
      email: "carol@example.com",
      phone: "+1 43554 54985",
      gender: "Female",
      bloodGroup: "B+",
      status: "Active",
      city: "Seattle",
      state: "Washington",
      country: "USA",
      address1: "88 Pine Ave",
      pincode: "98101",
      lastVisitedAt: new Date("2025-04-02"),
      primaryDoctorId: doc3?.id ?? doc1?.id,
    },
    {
      patientCode: "PT004",
      firstName: "Bernard",
      lastName: "Griffith",
      email: "bernard@example.com",
      phone: "+1 45214 98741",
      gender: "Male",
      bloodGroup: "AB+",
      status: "Active",
      city: "Boston",
      state: "Massachusetts",
      country: "USA",
      address1: "5 Harbor View",
      pincode: "02108",
      lastVisitedAt: new Date("2025-02-01"),
      primaryDoctorId: doc1?.id,
    },
  ];

  for (const p of patientSeed) {
    if (!p.primaryDoctorId) continue;
    await prisma.patient.create({
      data: {
        ...p,
        dob: new Date("1998-06-15"),
        clinicId: clinic.id,
      },
    });
  }

  console.log(`Created ${patientSeed.length} patients`);

  const patients = await prisma.patient.findMany({
    where: { clinicId: clinic.id },
    orderBy: { createdAt: "asc" },
  });

  const appointmentSeed = [
    {
      appointmentCode: "AP001",
      patientId: patients[0]?.id,
      doctorId: doc1?.id,
      departmentId: cardiologyDept.id,
      scheduledAt: new Date("2025-04-30T09:30:00"),
      mode: "In-person",
      appointmentType: "Offline Consultation",
      status: "Checked Out",
      reason: "Routine follow-up",
      location: "Miami, USA",
    },
    {
      appointmentCode: "AP002",
      patientId: patients[1]?.id,
      doctorId: doc2?.id ?? doc1?.id,
      departmentId: orthopedicsDept.id,
      scheduledAt: new Date("2025-04-15T11:20:00"),
      mode: "Online",
      appointmentType: "Online Consultation",
      status: "Checked In",
      reason: "Knee pain consultation",
      location: "Austin, USA",
    },
    {
      appointmentCode: "AP003",
      patientId: patients[2]?.id,
      doctorId: doc3?.id ?? doc1?.id,
      departmentId: nursingDept.id,
      scheduledAt: new Date("2025-04-02T08:15:00"),
      mode: "In-person",
      appointmentType: "Offline Consultation",
      status: "Cancelled",
      reason: "Patient rescheduled",
      location: "Seattle, USA",
    },
    {
      appointmentCode: "AP004",
      patientId: patients[0]?.id,
      doctorId: doc1?.id,
      departmentId: cardiologyDept.id,
      scheduledAt: new Date("2025-05-20T14:00:00"),
      mode: "Online",
      appointmentType: "Online Consultation",
      status: "Confirmed",
      reason: "ECG review",
      location: "Miami, USA",
    },
    {
      appointmentCode: "AP005",
      patientId: patients[3]?.id,
      doctorId: doc1?.id,
      departmentId: cardiologyDept.id,
      scheduledAt: new Date("2025-05-25T10:00:00"),
      mode: "In-person",
      appointmentType: "Offline Consultation",
      status: "Schedule",
      reason: "Initial consultation",
      location: "Boston, USA",
    },
  ];

  let apCount = 0;
  for (const a of appointmentSeed) {
    if (!a.patientId || !a.doctorId) continue;
    await prisma.appointment.create({
      data: { ...a, clinicId: clinic.id },
    });
    apCount++;
  }
  console.log(`Created ${apCount} appointments`);

  console.log("\n========== SEED COMPLETE ==========");
  console.log("Login (use clinic owner for full access):");
  console.log("  Clinic Owner: owner@clinic.com     | owner123");
  console.log("  Admin:        admin@clinic.com     | admin123");
  console.log("  Doctor:       doctor@clinic.com    | doctor123");
  console.log("  Patient:      patient@clinic.com   | patient123");
  console.log("  Porter:       porter@clinic.com    | porter123");
  console.log("  Super Admin:  superadmin@clinic.com | superadmin123");
  console.log("==================================\n");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
