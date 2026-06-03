
import { PrismaClient, Role, ClinicStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function run() {
    const hash = await bcrypt.hash("owner123", 10);
    const pkg = await prisma.subscriptionPackage.create({
        data: { name: "Free Trial", price: 0, durationInDays: 30, maxDoctors: 10, maxPatients: 100, maxAppointments: 500, isActive: true }
    });
    const clinic = await prisma.clinic.create({
        data: { name: "Docyori Clinic", status: "TRIAL", packageId: pkg.id, packageStartsAt: new Date(), packageExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    });
    const user = await prisma.user.create({
        data: { email: "owner@clinic.com", passwordHash: hash, fullName: "Clinic Owner", role: "ADMIN", clinicId: clinic.id }
    });
    const dept = await prisma.department.create({
        data: { name: "Cardiology", status: "Active", clinicId: clinic.id }
    });
    await prisma.designation.create({
        data: { name: "Cardiologist", status: "Active", clinicId: clinic.id, departmentId: dept.id }
    });
    console.log("Mini seed done!");
    process.exit(0);
}
run();
