import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables immediately
dotenv.config();

import path from "path";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes";
import packageRoutes from "./routes/package.routes";
import todoRoutes from "./routes/todo.routes";
import { authenticateJWT } from "./middlewares/auth.middleware";
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
import productRoutes from "./routes/product.routes";
import holidayRoutes from "./routes/holiday.routes";
import payrollRoutes from "./routes/payroll.routes";
import expenseRoutes from "./routes/expense.routes";
import expenseCategoryRoutes from "./routes/expenseCategory.routes";
import leaveTypeRoutes from "./routes/leaveType.routes";
import leaveRoutes from "./routes/leave.routes";
import attendanceRoutes from "./routes/attendance.routes";
import prescriptionRoutes from "./routes/prescription.routes";
import clinicRoleRoutes from "./routes/clinicRole.routes";
import invoiceRoutes from "./routes/invoice.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import superadminRoutes from "./routes/superadmin.routes";
import notificationRoutes from "./routes/notification.routes";
import settingsRoutes from "./routes/settings.routes";
import landingRoutes from "./routes/landing.routes";
import demoBookingRoutes from "./routes/demoBooking.routes";
import supportRoutes from "./routes/support.routes";
import noteRoutes from "./routes/note.routes";
import paymentRoutes from "./routes/payment.routes";
import searchRoutes from "./routes/search.routes";
import labCategoryRoutes from "./routes/labCategory.routes";
import labTestRoutes from "./routes/labTest.routes";
import labBookingRoutes from "./routes/labBooking.routes";


const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173,https://docyori.com,https://api.docyori.com")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Tenant-ID'],
  })
);
app.use(express.json({ limit: "1000mb" }));
app.use(express.urlencoded({ limit: "1000mb", extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Rate limiting on auth routes (200 requests per 15 minutes)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/staffs", staffRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/products", productRoutes);
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
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/landing", landingRoutes);
app.use("/api/demo-booking", demoBookingRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/lab-categories", labCategoryRoutes);
app.use("/api/lab-tests", labTestRoutes);
app.use("/api/lab-bookings", labBookingRoutes);
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

// Global Error Handler — must be last middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Unhandled Error]", err.stack || err.message);
  res.status(500).json({ message: err.message || "Internal Server Error" });
});
