import { PrismaClient, Role, ClinicStatus } from "./generated/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting database seeding (Full Realistic Data)...");

  // 1. CLEAR DATABASE (in safe foreign key order)
  await prisma.demoBooking.deleteMany({});
  await prisma.systemSetting.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.prescriptionMedicine.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.leave.deleteMany({});
  await prisma.leaveType.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.expenseCategory.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.landingPage.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.staff.deleteMany({});
  await prisma.doctor.updateMany({ data: { departmentId: null, designationId: null } });
  await prisma.doctor.deleteMany({});
  await prisma.specialization.deleteMany({});
  await prisma.designation.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.clinicRole.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.clinic.deleteMany({});
  await prisma.subscriptionPackage.deleteMany({});

  const hash = (pw: string) => bcrypt.hash(pw, 10);

  // Generate generic password for all test accounts
  const defaultPasswordStr = "Password@123";
  const defaultPassword = await hash(defaultPasswordStr);

  // 2. SUBSCRIPTION PACKAGES
  const freeTrialPackage = await prisma.subscriptionPackage.create({
    data: {
      name: "14 Days Free Trial",
      price: 0,
      durationInDays: 14,
      maxDoctors: 5,
      maxPatients: 500,
      maxAppointments: 1000,
      isActive: true,
    },
  });

  const premiumPackage = await prisma.subscriptionPackage.create({
    data: {
      name: "Premium Plan (Annually)",
      price: 199.99,
      durationInDays: 365,
      maxDoctors: 50,
      maxPatients: 10000,
      maxAppointments: 50000,
      isActive: true,
    },
  });

  // 3. SUPER ADMIN
  await prisma.user.create({
    data: {
      email: "superadmin@docyori.com",
      username: "globaladmin",
      fullName: "DocYori Administrator",
      phone: "1111111111",
      passwordHash: defaultPassword,
      role: Role.SUPER_ADMIN,
    },
  });

  // 4. CLINIC SETUP
  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const clinic = await prisma.clinic.create({
    data: {
      name: "Apollo Multispeciality Clinic",
      username: "apollo",
      ownerName: "Dr. Mukesh Ambani",
      ownerEmail: "owner@docyori.com",
      whatsappNumber: "9876543210",
      phone: "9876543210",
      addressLine1: "Bandra Kurla Complex",
      addressLine2: "Beside Jio World",
      district: "Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400051",
      doctorCount: 15,
      status: ClinicStatus.UPGRADED,
      packageId: premiumPackage.id,
      packageStartsAt: new Date(),
      packageExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isTrialUsed: true,
    },
  });

  // 5. CLINIC OWNER / ADMIN
  const owner = await prisma.user.create({
    data: {
      email: "owner@docyori.com",
      username: "apollo_owner",
      fullName: "Dr. Mukesh Ambani",
      phone: "9876543210",
      passwordHash: defaultPassword,
      role: Role.ADMIN,
      clinicId: clinic.id,
    },
  });

  // 6. CLINIC DEPARTMENTS
  const deptCardio = await prisma.department.create({
    data: { name: "Cardiology", description: "Heart Care Unit", clinicId: clinic.id },
  });
  const deptOrtho = await prisma.department.create({
    data: { name: "Orthopedics", description: "Joint & Bone Care", clinicId: clinic.id },
  });
  const deptNeuro = await prisma.department.create({
    data: { name: "Neurology", description: "Brain & Nerves", clinicId: clinic.id },
  });

  // 7. CLINIC DESIGNATIONS
  const desigHeadCardio = await prisma.designation.create({
    data: { name: "Head of Cardiology", type: "Doctor", departmentId: deptCardio.id, clinicId: clinic.id },
  });
  const desigSeniorOrtho = await prisma.designation.create({
    data: { name: "Senior Orthopedic Surgeon", type: "Doctor", departmentId: deptOrtho.id, clinicId: clinic.id },
  });

  // 8. SPECIALIZATIONS
  const specHeart = await prisma.specialization.create({
    data: { name: "Heart Surgery", clinicId: clinic.id },
  });
  const specBone = await prisma.specialization.create({
    data: { name: "Knee Replacement", clinicId: clinic.id },
  });
  const specNeuro = await prisma.specialization.create({
    data: { name: "Brain Specialist", clinicId: clinic.id },
  });

  // 9. DOCTOR PROFILES & USERS
  const defaultSchedule = {
    Monday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }, { session: "Evening", from: "16:00:00", to: "20:00:00" }],
    Tuesday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Wednesday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Thursday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Friday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
  };

  const doctorAuth1 = await prisma.user.create({
    data: {
      email: "doctor@docyori.com",
      username: "dr_sarah",
      fullName: "Dr. Sarah Connor",
      phone: "9123456781",
      passwordHash: defaultPassword,
      role: Role.DOCTOR,
      clinicId: clinic.id,
    },
  });

  const doctor1 = await prisma.doctor.create({
    data: {
      fullName: "Dr. Sarah Connor",
      email: "doctor@docyori.com",
      username: "dr_sarah",
      phone: "9123456781",
      departmentId: deptCardio.id,
      designationId: desigHeadCardio.id,
      medicalLicenseNumber: "MED-IN-100456",
      yearOfExperience: 15,
      consultationCharge: 1200,
      appointmentDuration: 20,
      languagesSpoken: ["English", "Hindi"],
      bloodGroup: "O+",
      gender: "Female",
      bio: "Awarded top cardiologist in Mumbai. Specializes in advanced heart surgeries and pediatric cardiology.",
      status: "Active",
      clinicId: clinic.id,
      schedules: defaultSchedule,
      maritalStatus: "Married",
      qualification: "MBBS, MD Cardiology (AIIMS)",
      followUpEnabled: true,
      followUpValidityDays: 10,
      freeFollowUpLimit: 1,
      specializations: {
        connect: [{ id: specHeart.id }]
      }
    },
  });

  const doctorAuth2 = await prisma.user.create({
    data: {
      email: "rohit.dr@docyori.com",
      username: "dr_rohit",
      fullName: "Dr. Rohit Jain",
      phone: "9123456782",
      passwordHash: defaultPassword,
      role: Role.DOCTOR,
      clinicId: clinic.id,
    },
  });

  const doctor2 = await prisma.doctor.create({
    data: {
      fullName: "Dr. Rohit Jain",
      email: "rohit.dr@docyori.com",
      username: "dr_rohit",
      phone: "9123456782",
      departmentId: deptOrtho.id,
      designationId: desigSeniorOrtho.id,
      medicalLicenseNumber: "MED-IN-934522",
      yearOfExperience: 10,
      consultationCharge: 800,
      appointmentDuration: 30,
      languagesSpoken: ["English", "Hindi", "Gujarati"],
      bloodGroup: "B+",
      gender: "Male",
      bio: "Specialist in Knee Replacement and Sports injuries.",
      status: "Active",
      clinicId: clinic.id,
      schedules: defaultSchedule,
      qualification: "MBBS, MS Orthopedics",
      specializations: {
        connect: [{ id: specBone.id }]
      }
    },
  });

  // 10. PATIENT PROFILES & USERS
  const patientAuth1 = await prisma.user.create({
    data: {
      email: "patient@docyori.com",
      username: "john_doe",
      fullName: "John Doe",
      phone: "9871234560",
      passwordHash: defaultPassword,
      role: Role.PATIENT,
      clinicId: clinic.id,
    },
  });

  const patient1 = await prisma.patient.create({
    data: {
      patientCode: "PT-10001",
      firstName: "John",
      lastName: "Doe",
      email: "patient@docyori.com",
      phone: "9871234560",
      gender: "Male",
      bloodGroup: "O+",
      dob: new Date("1995-08-15"),
      address1: "Andheri West, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400053",
      primaryDoctorId: doctor1.id,
      clinicId: clinic.id,
      vitals: { height: "175cm", weight: "70kg", bp: "120/80" },
      lastVisitedAt: new Date(),
    },
  });

  const patient2 = await prisma.patient.create({
    data: {
      patientCode: "PT-10002",
      firstName: "Alia",
      lastName: "Bhatt",
      email: "alia@docyori.com",
      phone: "8887776665",
      gender: "Female",
      bloodGroup: "A+",
      dob: new Date("1992-03-10"),
      address1: "Juhu, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      primaryDoctorId: doctor2.id,
      clinicId: clinic.id,
    },
  });

  // 11. APPOINTMENTS
  await prisma.appointment.create({
    data: {
      appointmentCode: "AP-5001",
      patientId: patient1.id,
      doctorId: doctor1.id,
      departmentId: deptCardio.id,
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Next 2 days
      mode: "In-person",
      appointmentType: "Offline Consultation",
      status: "Confirmed",
      reason: "High Blood Pressure issues",
      location: "Clinic Branch 1",
      clinicId: clinic.id,
    },
  });

  await prisma.appointment.create({
    data: {
      appointmentCode: "AP-5002",
      patientId: patient2.id,
      doctorId: doctor2.id,
      departmentId: deptOrtho.id,
      scheduledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
      mode: "Online",
      appointmentType: "Video Consultation",
      status: "Completed",
      reason: "Knee ache",
      clinicId: clinic.id,
    },
  });

  // 12. SERVICES & INVOICES
  const consultationService = await prisma.service.create({
    data: {
      serviceName: "Standard Consultation",
      price: 500,
      departmentId: deptCardio.id,
      clinicId: clinic.id,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceCode: "INV-2026-001",
      patientId: patient2.id,
      invoiceDate: new Date(),
      dueDate: new Date(),
      tax: 50,
      discount: 0,
      subTotal: 500,
      totalAmount: 550,
      paymentMethod: "Credit Card",
      paymentStatus: "Paid",
      clinicId: clinic.id,
    },
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoice.id,
      serviceId: consultationService.id,
      description: "Standard Consultation - Dr. Rohit Jain",
      quantity: 1,
      unitCost: 500,
      amount: 500,
      clinicId: clinic.id,
    },
  });

  console.log("✅ Seed completed successfully!");
  console.log("-----------------------------------------");
  console.log("🔑 LOGIN CREDENTIALS");
  console.log("All accounts share the SAME password => Password@123");
  console.log("");
  console.log("- Super Admin: superadmin@docyori.com");
  console.log("- Clinic Admin: owner@docyori.com");
  console.log("- Doctor: doctor@docyori.com");
  console.log("- Patient: patient@docyori.com");
  console.log("-----------------------------------------");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
