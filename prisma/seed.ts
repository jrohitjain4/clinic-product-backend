import { PrismaClient, Role, ClinicStatus } from "./generated/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting database seeding (Full Rich Realistic Test Data)...");

  // 1. CLEAR DATABASE (in safe foreign key order — ALL tables)
  await prisma.demoBooking.deleteMany({});
  await prisma.systemSetting.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.todo.deleteMany({});
  await prisma.ticket.deleteMany({});
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
  await prisma.workingDaysConfig.deleteMany({});
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
      maxDoctors: 10,
      maxPatients: 1000,
      maxAppointments: 5000,
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
      gstNumber: "GSTIN27APOLLO123",
      emergencyContact: "9876543211",
      doctorCount: 15,
      status: ClinicStatus.UPGRADED,
      packageId: premiumPackage.id,
      packageStartsAt: new Date(),
      packageExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isTrialUsed: true,
    },
  });

  // 5. LANDING PAGE FOR CLINIC
  const mockReviews = [
    {
      name: "Amit Kumar",
      rating: 5,
      feedback: "Excellent experience! The doctor was very attentive and the staff was friendly. Will recommend to others."
    },
    {
      name: "Neha Sharma",
      rating: 5,
      feedback: "Very clean clinic. The consulting fee is reasonable and the diagnosis was highly accurate."
    },
    {
      name: "Rahul Malhotra",
      rating: 4,
      feedback: "Good doctors, very polite staff. Waiting time is slightly higher but consultation is extremely detailed."
    }
  ];

  const mockGallery = [
    { url: "assets/img/clinic-gallery-1.jpg", category: "Consultation Room", caption: "Equipped with state-of-the-art diagnostic tools" },
    { url: "assets/img/clinic-gallery-2.jpg", category: "Reception Area", caption: "Welcoming and comfortable lounge for patients" }
  ];

  await prisma.landingPage.create({
    data: {
      clinicId: clinic.id,
      tagline: "Quality Healthcare for Your Family",
      whatsapp: "9876543210",
      email: "info@citycareclinic.com",
      about: "Apollo Multispeciality Clinic is a state-of-the-art healthcare center committed to providing high-quality medical services with compassion and care. We have a team of experienced doctors and modern facilities to ensure the best treatment for you and your family.",
      established: 2018,
      patientsServed: "15000+",
      experience: 15,
      reviews: mockReviews,
      gallery: mockGallery,
      logo: "/uploads/logos/apollo-logo.png"
    }
  });

  // 6. CLINIC OWNER / ADMIN
  await prisma.user.create({
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

  // 7. CLINIC DEPARTMENTS
  const deptCardio = await prisma.department.create({
    data: { name: "Cardiology", description: "Heart & Vascular Care Unit", clinicId: clinic.id },
  });
  const deptOrtho = await prisma.department.create({
    data: { name: "Orthopedics", description: "Joint & Bone Care", clinicId: clinic.id },
  });
  const deptPediatric = await prisma.department.create({
    data: { name: "Pediatrics", description: "Child Care & Pediatric Wellness", clinicId: clinic.id },
  });
  const deptDerm = await prisma.department.create({
    data: { name: "Dermatology", description: "Skin, Hair & Cosmetic Treatments", clinicId: clinic.id },
  });

  // 8. CLINIC DESIGNATIONS
  const desigHeadCardio = await prisma.designation.create({
    data: { name: "Head of Cardiology", type: "Doctor", departmentId: deptCardio.id, clinicId: clinic.id },
  });
  const desigSeniorOrtho = await prisma.designation.create({
    data: { name: "Senior Orthopedic Surgeon", type: "Doctor", departmentId: deptOrtho.id, clinicId: clinic.id },
  });
  const desigPediatricConsultant = await prisma.designation.create({
    data: { name: "Consultant Pediatrician", type: "Doctor", departmentId: deptPediatric.id, clinicId: clinic.id },
  });
  const desigSeniorDerm = await prisma.designation.create({
    data: { name: "Senior Dermatologist", type: "Doctor", departmentId: deptDerm.id, clinicId: clinic.id },
  });

  // 9. SPECIALIZATIONS
  const specCardio = await prisma.specialization.create({
    data: { name: "Interventional Cardiology", clinicId: clinic.id },
  });
  const specOrtho = await prisma.specialization.create({
    data: { name: "Joint Replacement & Arthroscopy", clinicId: clinic.id },
  });
  const specPediatric = await prisma.specialization.create({
    data: { name: "Neonatology & Pediatric Care", clinicId: clinic.id },
  });
  const specDerm = await prisma.specialization.create({
    data: { name: "Cosmetic Dermatology", clinicId: clinic.id },
  });

  // 10. DOCTOR PROFILES & USERS
  const defaultSchedule = {
    Monday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }, { session: "Evening", from: "16:00:00", to: "20:00:00" }],
    Tuesday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Wednesday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Thursday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
    Friday: [{ session: "Morning", from: "09:00:00", to: "13:00:00" }],
  };

  // Dr. Sarah Connor
  await prisma.user.create({
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
      followUpFee: 0,
      specializations: {
        connect: [{ id: specCardio.id }]
      }
    },
  });

  // Dr. Rohit Jain
  await prisma.user.create({
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
      followUpEnabled: true,
      followUpValidityDays: 7,
      freeFollowUpLimit: 0,
      followUpFee: 400,
      specializations: {
        connect: [{ id: specOrtho.id }]
      }
    },
  });

  // Dr. Amit Sharma
  await prisma.user.create({
    data: {
      email: "amit.dr@docyori.com",
      username: "dr_amit",
      fullName: "Dr. Amit Sharma",
      phone: "9123456783",
      passwordHash: defaultPassword,
      role: Role.DOCTOR,
      clinicId: clinic.id,
    },
  });

  const doctor3 = await prisma.doctor.create({
    data: {
      fullName: "Dr. Amit Sharma",
      email: "amit.dr@docyori.com",
      username: "dr_amit",
      phone: "9123456783",
      departmentId: deptPediatric.id,
      designationId: desigPediatricConsultant.id,
      medicalLicenseNumber: "MED-IN-445892",
      yearOfExperience: 12,
      consultationCharge: 600,
      appointmentDuration: 15,
      languagesSpoken: ["English", "Hindi", "Punjabi"],
      bloodGroup: "A+",
      gender: "Male",
      bio: "Caring pediatrician with a decade of experience in child health, immunizations, and critical infant care.",
      status: "Active",
      clinicId: clinic.id,
      schedules: defaultSchedule,
      qualification: "MBBS, DCH, MD Pediatrics",
      followUpEnabled: true,
      followUpValidityDays: 15,
      freeFollowUpLimit: 2,
      followUpFee: 0,
      specializations: {
        connect: [{ id: specPediatric.id }]
      }
    },
  });

  // Dr. Priya Patel
  await prisma.user.create({
    data: {
      email: "priya.dr@docyori.com",
      username: "dr_priya",
      fullName: "Dr. Priya Patel",
      phone: "9123456784",
      passwordHash: defaultPassword,
      role: Role.DOCTOR,
      clinicId: clinic.id,
    },
  });

  const doctor4 = await prisma.doctor.create({
    data: {
      fullName: "Dr. Priya Patel",
      email: "priya.dr@docyori.com",
      username: "dr_priya",
      phone: "9123456784",
      departmentId: deptDerm.id,
      designationId: desigSeniorDerm.id,
      medicalLicenseNumber: "MED-IN-889410",
      yearOfExperience: 8,
      consultationCharge: 900,
      appointmentDuration: 20,
      languagesSpoken: ["English", "Hindi", "Marathi"],
      bloodGroup: "AB+",
      gender: "Female",
      bio: "Experienced skin specialist focusing on cosmetic dermatology, acne treatments, and laser procedures.",
      status: "Active",
      clinicId: clinic.id,
      schedules: defaultSchedule,
      qualification: "MBBS, MD Dermatology",
      followUpEnabled: false,
      specializations: {
        connect: [{ id: specDerm.id }]
      }
    },
  });

  // 11. PATIENT PROFILES & USERS
  // Patient 1 - John Doe
  await prisma.user.create({
    data: {
      email: "patient@docyori.com",
      username: "john_doe",
      fullName: "John Doe",
      phone: "9856332800",
      passwordHash: defaultPassword,
      role: Role.PATIENT,
      clinicId: clinic.id,
    },
  });

  const patient1 = await prisma.patient.create({
    data: {
      patientCode: "PAT00001",
      firstName: "John",
      lastName: "Doe",
      email: "patient@docyori.com",
      phone: "9856332800",
      gender: "Male",
      bloodGroup: "O+",
      dob: new Date("1990-08-15"),
      address1: "Bandra East, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400051",
      clinicId: clinic.id,
      vitals: { height: "178cm", weight: "75kg", bp: "120/80", sugar: "95", pulse: "72", temp: "98.6" },
      lastVisitedAt: new Date(),
    },
  });

  // Patient 2 - Alia Bhatt
  await prisma.user.create({
    data: {
      email: "alia@docyori.com",
      username: "alia_b",
      fullName: "Alia Bhatt",
      phone: "9856332801",
      passwordHash: defaultPassword,
      role: Role.PATIENT,
      clinicId: clinic.id,
    },
  });

  const patient2 = await prisma.patient.create({
    data: {
      patientCode: "PAT00002",
      firstName: "Alia",
      lastName: "Bhatt",
      email: "alia@docyori.com",
      phone: "9856332801",
      gender: "Female",
      bloodGroup: "A+",
      dob: new Date("1993-03-15"),
      address1: "Juhu, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400049",
      clinicId: clinic.id,
      vitals: { height: "165cm", weight: "54kg", bp: "115/75", sugar: "88", pulse: "76", temp: "98.4" },
    },
  });

  // Patient 3 - Rahul Verma
  await prisma.user.create({
    data: {
      email: "rahul@docyori.com",
      username: "rahul_v",
      fullName: "Rahul Verma",
      phone: "9856332802",
      passwordHash: defaultPassword,
      role: Role.PATIENT,
      clinicId: clinic.id,
    },
  });

  const patient3 = await prisma.patient.create({
    data: {
      patientCode: "PAT00003",
      firstName: "Rahul",
      lastName: "Verma",
      email: "rahul@docyori.com",
      phone: "9856332802",
      gender: "Male",
      bloodGroup: "B+",
      dob: new Date("1985-11-22"),
      address1: "Andheri West, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400053",
      clinicId: clinic.id,
      vitals: { height: "180cm", weight: "82kg", bp: "130/85", sugar: "110", pulse: "80", temp: "99.0" },
    },
  });

  // Patient 4 - Priya Singh
  await prisma.user.create({
    data: {
      email: "priya@docyori.com",
      username: "priya_s",
      fullName: "Priya Singh",
      phone: "9856332803",
      passwordHash: defaultPassword,
      role: Role.PATIENT,
      clinicId: clinic.id,
    },
  });

  const patient4 = await prisma.patient.create({
    data: {
      patientCode: "PAT00004",
      firstName: "Priya",
      lastName: "Singh",
      email: "priya@docyori.com",
      phone: "9856332803",
      gender: "Female",
      bloodGroup: "AB-",
      dob: new Date("1998-05-30"),
      address1: "Chembur, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400071",
      clinicId: clinic.id,
      vitals: { height: "160cm", weight: "50kg", bp: "110/70", sugar: "90", pulse: "70", temp: "98.2" },
    },
  });

  // Patient 5 - Baby Aarav (Pediatric Patient - Registered)
  await prisma.user.create({
    data: {
      email: "aarav@docyori.com",
      username: "baby_aarav",
      fullName: "Baby Aarav Sharma",
      phone: "9856332804",
      passwordHash: defaultPassword,
      role: Role.PATIENT,
      clinicId: clinic.id,
    },
  });

  const patient5 = await prisma.patient.create({
    data: {
      patientCode: "PAT00005",
      firstName: "Aarav",
      lastName: "Sharma",
      email: "aarav@docyori.com",
      phone: "9856332804",
      gender: "Male",
      bloodGroup: "O+",
      dob: new Date("2025-10-10"), // Infant
      address1: "Ghatkopar, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400077",
      clinicId: clinic.id,
      vitals: { height: "72cm", weight: "9.5kg", bp: "85/55", sugar: "82", pulse: "110", temp: "98.6" },
    },
  });

  // Patient 6 - Rajesh Kumar (Walk-in Offline Patient - NOT linked to any User record)
  const patient6 = await prisma.patient.create({
    data: {
      patientCode: "PAT00006",
      firstName: "Rajesh",
      lastName: "Kumar",
      email: "rajesh.walkin@gmail.com",
      phone: "9856332805",
      gender: "Male",
      bloodGroup: "B+",
      dob: new Date("1978-04-20"),
      address1: "Sion, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400022",
      clinicId: clinic.id,
      vitals: { height: "172cm", weight: "80kg", bp: "140/90", sugar: "145", pulse: "84", temp: "98.9" },
    },
  });

  // 12. SERVICES
  const serviceConsultSarah = await prisma.service.create({
    data: { serviceName: "Cardiology Consultation", price: 1200, departmentId: deptCardio.id, clinicId: clinic.id },
  });
  const serviceConsultRohit = await prisma.service.create({
    data: { serviceName: "Orthopedic Consultation", price: 800, departmentId: deptOrtho.id, clinicId: clinic.id },
  });
  const serviceConsultAmit = await prisma.service.create({
    data: { serviceName: "Pediatric Consultation", price: 600, departmentId: deptPediatric.id, clinicId: clinic.id },
  });
  const serviceConsultPriya = await prisma.service.create({
    data: { serviceName: "Dermatology Consultation", price: 900, departmentId: deptDerm.id, clinicId: clinic.id },
  });
  const serviceImmunization = await prisma.service.create({
    data: { serviceName: "Child Immunization Service", price: 1000, departmentId: deptPediatric.id, clinicId: clinic.id },
  });
  const serviceLaserSession = await prisma.service.create({
    data: { serviceName: "Skin Laser Session", price: 2500, departmentId: deptDerm.id, clinicId: clinic.id },
  });

  // 13. APPOINTMENTS
  // Appointment 1 - Completed Yesterday (Dr. Sarah Connor, Patient: John Doe)
  const appt1 = await prisma.appointment.create({
    data: {
      appointmentCode: "AP055",
      patientId: patient1.id,
      doctorId: doctor1.id,
      departmentId: deptCardio.id,
      scheduledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
      mode: "In-person",
      appointmentType: "Standard Visit",
      status: "Completed",
      reason: "Routine Heart Checkup",
      location: "Clinic Main Office",
      clinicId: clinic.id,
      paymentStatus: "Paid",
    },
  });

  // Appointment 2 - Confirmed Today (Dr. Sarah Connor, Patient: Alia Bhatt) - ONLINE Type
  const appt2 = await prisma.appointment.create({
    data: {
      appointmentCode: "AP056",
      patientId: patient2.id,
      doctorId: doctor1.id,
      departmentId: deptCardio.id,
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // Today in 2 hours
      mode: "Online",
      appointmentType: "Urgent Visit",
      status: "Confirmed",
      reason: "Mild chest tightness",
      location: "Telehealth Video Link",
      clinicId: clinic.id,
      paymentStatus: "Unpaid",
    },
  });

  // Appointment 3 - Checked In Today (Dr. Rohit Jain, Patient: Rahul Verma) - IN-PERSON Type
  const appt3 = await prisma.appointment.create({
    data: {
      appointmentCode: "AP057",
      patientId: patient3.id,
      doctorId: doctor2.id,
      departmentId: deptOrtho.id,
      scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Today 2 hours ago
      mode: "In-person",
      appointmentType: "Standard Visit",
      status: "Checked In",
      reason: "Knee pain treatment",
      location: "Room 102",
      clinicId: clinic.id,
      paymentStatus: "Paid",
    },
  });

  // Appointment 4 - Checked Out Today (Dr. Amit Sharma, Patient: Baby Aarav - Pediatric)
  const appt4 = await prisma.appointment.create({
    data: {
      appointmentCode: "AP058",
      patientId: patient5.id,
      doctorId: doctor3.id,
      departmentId: deptPediatric.id,
      scheduledAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // Today 4 hours ago
      mode: "In-person",
      appointmentType: "Vaccination Visit",
      status: "Checked Out",
      reason: "Infant immunization schedule",
      location: "Pediatric Lounge",
      clinicId: clinic.id,
      paymentStatus: "Paid",
    },
  });

  // Appointment 5 - Schedule Tomorrow (Dr. Priya Patel, Patient: John Doe) - ONLINE Type
  const appt5 = await prisma.appointment.create({
    data: {
      appointmentCode: "AP059",
      patientId: patient1.id,
      doctorId: doctor4.id,
      departmentId: deptDerm.id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      mode: "Online",
      appointmentType: "Consultation Only",
      status: "Schedule",
      reason: "Skin allergy check",
      location: "Telehealth Video Link",
      clinicId: clinic.id,
      paymentStatus: "Unpaid",
    },
  });

  // Appointment 6 - Follow-up Confirmed (Dr. Sarah Connor, Patient: John Doe)
  const appt6 = await prisma.appointment.create({
    data: {
      appointmentCode: "AP060",
      patientId: patient1.id,
      doctorId: doctor1.id,
      departmentId: deptCardio.id,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Next 3 days
      mode: "In-person",
      appointmentType: "Follow-up",
      status: "Confirmed",
      isFollowUp: true,
      followUpStatus: "Free Follow-up",
      paymentStatus: "Free",
      parentAppointmentId: appt1.id,
      reason: "Review blood pressure log",
      location: "Clinic Main Office",
      clinicId: clinic.id,
    },
  });

  // Appointment 7 - Walk-in Offline (Dr. Rohit Jain, Patient: Rajesh Kumar)
  const appt7 = await prisma.appointment.create({
    data: {
      appointmentCode: "AP061",
      patientId: patient6.id,
      doctorId: doctor2.id,
      departmentId: deptOrtho.id,
      scheduledAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // Today 5 hours ago
      mode: "In-person",
      appointmentType: "Walk-in",
      status: "Completed",
      reason: "Joint sprain emergency",
      location: "Room 102",
      clinicId: clinic.id,
      paymentStatus: "Paid",
    },
  });

  // 14. INVOICES & INVOICE ITEMS
  // Invoice 1 for Appointment 1 (John Doe)
  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceCode: "INV-178210792381",
      patientId: patient1.id,
      appointmentId: appt1.id,
      invoiceDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      tax: 18,
      discount: 100,
      subTotal: 1200,
      totalAmount: 1316, 
      paymentMethod: "UPI",
      paymentStatus: "Paid",
      clinicId: clinic.id,
      otherInfo: "TxnID: UPI998240184028 (GPay)",
    },
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoice1.id,
      serviceId: serviceConsultSarah.id,
      description: "Cardiology Consultation Fee - Dr. Sarah Connor",
      quantity: 1,
      unitCost: 1200,
      amount: 1200,
      clinicId: clinic.id,
    },
  });

  // Invoice 2 for Appointment 3 (Rahul Verma)
  const invoice2 = await prisma.invoice.create({
    data: {
      invoiceCode: "INV-178210792382",
      patientId: patient3.id,
      appointmentId: appt3.id,
      invoiceDate: new Date(),
      dueDate: new Date(),
      tax: 18,
      discount: 0,
      subTotal: 800,
      totalAmount: 944, 
      paymentMethod: "Cash",
      paymentStatus: "Paid",
      clinicId: clinic.id,
      otherInfo: "Paid at Billing Desk Cashier #2 (Cash)",
    },
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoice2.id,
      serviceId: serviceConsultRohit.id,
      description: "Orthopedic Consultation Fee - Dr. Rohit Jain",
      quantity: 1,
      unitCost: 800,
      amount: 800,
      clinicId: clinic.id,
    },
  });

  // Invoice 3 for Appointment 4 (Baby Aarav - Pediatric)
  const invoice3 = await prisma.invoice.create({
    data: {
      invoiceCode: "INV-178210792383",
      patientId: patient5.id,
      appointmentId: appt4.id,
      invoiceDate: new Date(),
      dueDate: new Date(),
      tax: 18,
      discount: 200,
      subTotal: 1600, 
      totalAmount: 1652, 
      paymentMethod: "Card",
      paymentStatus: "Paid",
      clinicId: clinic.id,
      otherInfo: "TxnID: CRD881294829384 (HDFC Visa)",
    },
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoice3.id,
      serviceId: serviceConsultAmit.id,
      description: "Pediatric Consultation Fee - Dr. Amit Sharma",
      quantity: 1,
      unitCost: 600,
      amount: 600,
      clinicId: clinic.id,
    },
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoice3.id,
      serviceId: serviceImmunization.id,
      description: "Child Immunization Service - Optional DPT vaccine booster",
      quantity: 1,
      unitCost: 1000,
      amount: 1000,
      clinicId: clinic.id,
    },
  });

  // Invoice 4 for Appointment 7 (Rajesh Kumar - Walk-in)
  const invoice4 = await prisma.invoice.create({
    data: {
      invoiceCode: "INV-178210792384",
      patientId: patient6.id,
      appointmentId: appt7.id,
      invoiceDate: new Date(),
      dueDate: new Date(),
      tax: 18,
      discount: 0,
      subTotal: 800,
      totalAmount: 944,
      paymentMethod: "Cash",
      paymentStatus: "Paid",
      clinicId: clinic.id,
      otherInfo: "Paid at Billing Desk Cashier #1 (Cash)",
    },
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoice4.id,
      serviceId: serviceConsultRohit.id,
      description: "Orthopedic Consultation Fee - Dr. Rohit Jain",
      quantity: 1,
      unitCost: 800,
      amount: 800,
      clinicId: clinic.id,
    },
  });

  // Invoice 5 for Appointment 2 (Alia Bhatt - Online Consultation - Partially Paid)
  const invoice5 = await prisma.invoice.create({
    data: {
      invoiceCode: "INV-178210792385",
      patientId: patient2.id,
      appointmentId: appt2.id,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Due in 5 days
      tax: 18,
      discount: 100,
      subTotal: 1200,
      totalAmount: 1298, 
      paymentMethod: "UPI",
      paymentStatus: "Partially Paid",
      clinicId: clinic.id,
      otherInfo: "TxnID: UPI882019482 (PhonePe). Paid ₹500 advance, balance ₹798 due.",
    },
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoice5.id,
      serviceId: serviceConsultSarah.id,
      description: "Cardiology Consultation Fee (Online) - Dr. Sarah Connor",
      quantity: 1,
      unitCost: 1200,
      amount: 1200,
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
  console.log("- Doctors:");
  console.log("  * Sarah Connor (Cardio): doctor@docyori.com");
  console.log("  * Rohit Jain (Ortho): rohit.dr@docyori.com");
  console.log("  * Amit Sharma (Pediatrics): amit.dr@docyori.com");
  console.log("  * Priya Patel (Dermatology): priya.dr@docyori.com");
  console.log("- Patients:");
  console.log("  * John Doe: patient@docyori.com");
  console.log("  * Alia Bhatt: alia@docyori.com");
  console.log("  * Rahul Verma: rahul@docyori.com");
  console.log("  * Priya Singh: priya@docyori.com");
  console.log("  * Baby Aarav (Pediatric): aarav@docyori.com");
  console.log("  * Rajesh Kumar (Walk-in Offline): (No User Account)");
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
