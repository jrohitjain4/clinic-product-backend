"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables immediately
dotenv_1.default.config();
const path_1 = __importDefault(require("path"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const package_routes_1 = __importDefault(require("./routes/package.routes"));
const todo_routes_1 = __importDefault(require("./routes/todo.routes"));
const tenant_routes_1 = __importDefault(require("./routes/tenant.routes"));
const department_routes_1 = __importDefault(require("./routes/department.routes"));
const designation_routes_1 = __importDefault(require("./routes/designation.routes"));
const doctor_routes_1 = __importDefault(require("./routes/doctor.routes"));
const staff_routes_1 = __importDefault(require("./routes/staff.routes"));
const patient_routes_1 = __importDefault(require("./routes/patient.routes"));
const appointment_routes_1 = __importDefault(require("./routes/appointment.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const service_routes_1 = __importDefault(require("./routes/service.routes"));
const specialization_routes_1 = __importDefault(require("./routes/specialization.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const holiday_routes_1 = __importDefault(require("./routes/holiday.routes"));
const payroll_routes_1 = __importDefault(require("./routes/payroll.routes"));
const expense_routes_1 = __importDefault(require("./routes/expense.routes"));
const expenseCategory_routes_1 = __importDefault(require("./routes/expenseCategory.routes"));
const leaveType_routes_1 = __importDefault(require("./routes/leaveType.routes"));
const leave_routes_1 = __importDefault(require("./routes/leave.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const prescription_routes_1 = __importDefault(require("./routes/prescription.routes"));
const clinicRole_routes_1 = __importDefault(require("./routes/clinicRole.routes"));
const invoice_routes_1 = __importDefault(require("./routes/invoice.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const superadmin_routes_1 = __importDefault(require("./routes/superadmin.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const landing_routes_1 = __importDefault(require("./routes/landing.routes"));
const demoBooking_routes_1 = __importDefault(require("./routes/demoBooking.routes"));
const support_routes_1 = __importDefault(require("./routes/support.routes"));
const note_routes_1 = __importDefault(require("./routes/note.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173,https://docyori.com,https://api.docyori.com")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
// Middleware
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Tenant-ID'],
}));
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
app.use("/uploads", express_1.default.static(path_1.default.join(process.cwd(), "uploads")));
// Rate limiting on auth routes (200 requests per 15 minutes)
const authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
});
// Routes
app.use("/api/health", health_routes_1.default);
app.use("/api/auth", authRateLimiter, auth_routes_1.default);
app.use("/api/packages", package_routes_1.default);
app.use("/api/support", support_routes_1.default);
app.use("/api/todos", todo_routes_1.default);
app.use("/api/notes", note_routes_1.default);
app.use("/api/tenants", tenant_routes_1.default);
app.use("/api/departments", department_routes_1.default);
app.use("/api/designations", designation_routes_1.default);
app.use("/api/doctors", doctor_routes_1.default);
app.use("/api/staffs", staff_routes_1.default);
app.use("/api/patients", patient_routes_1.default);
app.use("/api/appointments", appointment_routes_1.default);
app.use("/api/services", service_routes_1.default);
app.use("/api/products", product_routes_1.default);
app.use("/api/specializations", specialization_routes_1.default);
app.use("/api/holidays", holiday_routes_1.default);
app.use("/api/payroll", payroll_routes_1.default);
app.use("/api/expenses", expense_routes_1.default);
app.use("/api/expense-categories", expenseCategory_routes_1.default);
app.use("/api/leave-types", leaveType_routes_1.default);
app.use("/api/leaves", leave_routes_1.default);
app.use("/api/attendance", attendance_routes_1.default);
app.use("/api/prescriptions", prescription_routes_1.default);
app.use("/api/clinic-roles", clinicRole_routes_1.default);
app.use("/api/uploads", upload_routes_1.default);
app.use("/api/invoices", invoice_routes_1.default);
app.use("/api/dashboard", dashboard_routes_1.default);
app.use("/api/superadmin", superadmin_routes_1.default);
app.use("/api/notifications", notification_routes_1.default);
app.use("/api/settings", settings_routes_1.default);
app.use("/api/landing", landing_routes_1.default);
app.use("/api/demo-booking", demoBooking_routes_1.default);
app.use("/api/support", support_routes_1.default);
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
app.use((err, _req, res, _next) => {
    console.error("[Unhandled Error]", err.stack || err.message);
    res.status(500).json({ message: err.message || "Internal Server Error" });
});
