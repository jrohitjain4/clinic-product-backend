import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import authRoutes from "./routes/auth.routes";
import packageRoutes from "./routes/package.routes";
import tenantRoutes from "./routes/tenant.routes";
import departmentRoutes from "./routes/department.routes";
import designationRoutes from "./routes/designation.routes";
import doctorRoutes from "./routes/doctor.routes";
import staffRoutes from "./routes/staff.routes";
import patientRoutes from "./routes/patient.routes";
import appointmentRoutes from "./routes/appointment.routes";
import uploadRoutes from "./routes/upload.routes";
import healthRoutes from "./routes/health.routes";
import serviceRoutes from "./routes/service.routes";
import specializationRoutes from "./routes/specialization.routes";
import holidayRoutes from "./routes/holiday.routes";
import payrollRoutes from "./routes/payroll.routes";
import expenseRoutes from "./routes/expense.routes";
import expenseCategoryRoutes from "./routes/expenseCategory.routes";
import leaveTypeRoutes from "./routes/leaveType.routes";
import leaveRoutes from "./routes/leave.routes";
import attendanceRoutes from "./routes/attendance.routes";
import prescriptionRoutes from "./routes/prescription.routes";
import clinicRoleRoutes from "./routes/clinicRole.routes";
import invoiceRoutes from "./routes/invoiceRoutes";
// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/staffs", staffRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/specializations", specializationRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/expense-categories", expenseCategoryRoutes);
app.use("/api/leave-types", leaveTypeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/clinic-roles", clinicRoleRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/invoices", invoiceRoutes);

// Root Check
app.get("/", (req, res) => {
  res.json({ message: "Clinic Management SaaS API is running perfectly!" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
