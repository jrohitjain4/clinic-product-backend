"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = exports.completeRegistration = exports.registerDraft = exports.upgradePlan = exports.getPackages = exports.getClinics = void 0;
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_controller_1 = require("./notification.controller");
const JWT_SECRET = process.env.JWT_SECRET; // Validated at startup in auth.middleware.ts
// Get all clinics (used during registration dropdown for doctors/patients/porters)
const getClinics = async (req, res) => {
    try {
        const clinics = await prisma_1.default.clinic.findMany({
            select: {
                id: true,
                name: true,
                subdomain: true,
            },
            orderBy: {
                name: "asc",
            },
        });
        return res.json(clinics);
    }
    catch (error) {
        console.error("Get clinics error:", error);
        return res.status(500).json({ message: "Internal server error fetching clinics" });
    }
};
exports.getClinics = getClinics;
// Get all active subscription packages
const getPackages = async (req, res) => {
    try {
        const packages = await prisma_1.default.subscriptionPackage.findMany({
            where: { isActive: true },
        });
        return res.json(packages);
    }
    catch (error) {
        console.error("Get packages error:", error);
        return res.status(500).json({ message: "Internal server error fetching packages" });
    }
};
exports.getPackages = getPackages;
// Upgrade / activate a plan for an existing clinic (post-trial)
const upgradePlan = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { packageId } = req.body;
        if (!packageId)
            return res.status(400).json({ message: "packageId is required" });
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            include: { clinic: true },
        });
        if (!user || !user.clinicId) {
            return res.status(404).json({ message: "Clinic not found for this user" });
        }
        const pkg = await prisma_1.default.subscriptionPackage.findUnique({ where: { id: packageId } });
        if (!pkg)
            return res.status(404).json({ message: "Package not found" });
        const now = new Date();
        const packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
        const status = pkg.price === 0 ? "TRIAL" : "UPGRADED";
        const updatedClinic = await prisma_1.default.clinic.update({
            where: { id: user.clinicId },
            data: {
                packageId,
                packageStartsAt: now,
                packageExpiresAt,
                status: status,
            },
        });
        // 🔔 Notify super admin
        try {
            await (0, notification_controller_1.createSuperAdminNotification)({
                type: "CLINIC_REGISTERED",
                title: "Clinic Plan Upgraded",
                message: `${user.clinic?.name || "A clinic"} has upgraded to ${pkg.name} (₹${pkg.price.toLocaleString("en-IN")}).`,
                link: "/super-admin/tenants",
            });
        }
        catch (_) { /* non-blocking */ }
        return res.json({
            message: "Plan activated successfully!",
            clinic: updatedClinic,
        });
    }
    catch (error) {
        console.error("Upgrade plan error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.upgradePlan = upgradePlan;
// Step 2: Register Draft (Personal + Business info)
const registerDraft = async (req, res) => {
    try {
        const { email, password, fullName, role, clinicInfo, dob, age, gender } = req.body;
        if (!email || !password || !fullName || !role || !clinicInfo) {
            return res.status(400).json({ message: "Essential fields are missing" });
        }
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "A user with this email already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const { name, address, gstNo } = clinicInfo;
        const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
        const newClinic = await prisma_1.default.clinic.create({
            data: {
                name,
                subdomain,
                gstNo,
                address,
                status: "IN_PROGRESS",
            }
        });
        const newUser = await prisma_1.default.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                fullName,
                dob: dob ? new Date(dob) : null,
                age: age ? parseInt(age.toString()) : null,
                gender,
                role: role,
                clinicId: newClinic.id,
            }
        });
        return res.status(201).json({
            message: "Draft created",
            userId: newUser.id
        });
    }
    catch (error) {
        console.error("Draft registration error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.registerDraft = registerDraft;
// Step 3: Complete Registration (Select Plan)
const completeRegistration = async (req, res) => {
    try {
        const { userId, packageId } = req.body;
        if (!userId || !packageId) {
            return res.status(400).json({ message: "UserId and PackageId are required" });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { clinic: true }
        });
        if (!user || !user.clinicId) {
            return res.status(404).json({ message: "Draft user or clinic not found" });
        }
        const pkg = await prisma_1.default.subscriptionPackage.findUnique({ where: { id: packageId } });
        if (!pkg) {
            return res.status(404).json({ message: "Package not found" });
        }
        const now = new Date();
        const packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
        const status = pkg.price === 0 ? "TRIAL" : "UPGRADED";
        await prisma_1.default.clinic.update({
            where: { id: user.clinicId },
            data: {
                packageId,
                packageStartsAt: now,
                packageExpiresAt,
                status: status
            }
        });
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId }, JWT_SECRET, { expiresIn: "7d" });
        // 🔔 Notify super admin about new clinic
        try {
            await (0, notification_controller_1.createSuperAdminNotification)({
                type: "CLINIC_REGISTERED",
                title: "New Clinic Registered",
                message: `${user.clinic?.name ?? "A new clinic"} has registered with the "${pkg?.name ?? "Free Trial"}" plan (${status}).`,
                link: "/super-admin/tenants",
            });
        }
        catch (_) { /* non-blocking */ }
        return res.json({
            message: "Registration completed!",
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                clinic: { ...user.clinic, status, packageId }
            },
        });
    }
    catch (error) {
        console.error("Complete registration error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.completeRegistration = completeRegistration;
// Register a new user and potential clinic tenant
const register = async (req, res) => {
    try {
        const { email, password, fullName, role, clinicId, clinicInfo, packageId, dob, age, gender } = req.body;
        if (!email || !password || !fullName || !role) {
            return res.status(400).json({ message: "All basic fields (email, password, fullName, role) are required" });
        }
        // Check if user already exists
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "A user with this email address already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        let assignedClinicId = clinicId;
        // Handle new Clinic creation for ADMIN/DOCTOR (3-step flow)
        if ((role === client_1.Role.ADMIN || role === client_1.Role.DOCTOR) && clinicInfo) {
            const { name, address, gstNo } = clinicInfo;
            if (!name) {
                return res.status(400).json({ message: "Clinic name is required for registration" });
            }
            // Auto-generate subdomain from name
            const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
            // Determine initial status
            let status = "IN_PROGRESS";
            let packageExpiresAt = null;
            if (packageId) {
                const pkg = await prisma_1.default.subscriptionPackage.findUnique({ where: { id: packageId } });
                if (pkg) {
                    const now = new Date();
                    packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
                    status = pkg.price === 0 ? "TRIAL" : "UPGRADED";
                }
            }
            const newClinic = await prisma_1.default.clinic.create({
                data: {
                    name,
                    subdomain,
                    gstNo,
                    address,
                    status: (status || "IN_PROGRESS"),
                    packageId,
                    packageStartsAt: packageId ? new Date() : null,
                    packageExpiresAt,
                }
            });
            assignedClinicId = newClinic.id;
        }
        else if (role !== client_1.Role.SUPER_ADMIN) {
            // Joining existing clinic
            if (!clinicId) {
                return res.status(400).json({ message: "Clinic selection is required" });
            }
            const clinicExists = await prisma_1.default.clinic.findUnique({ where: { id: clinicId } });
            if (!clinicExists) {
                return res.status(404).json({ message: "The selected clinic does not exist" });
            }
        }
        // Create User
        const newUser = await prisma_1.default.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                fullName,
                dob: dob ? new Date(dob) : null,
                age: age ? parseInt(age.toString()) : null,
                gender,
                role: role,
                clinicId: role === client_1.Role.SUPER_ADMIN ? null : assignedClinicId,
            },
            include: {
                clinic: {
                    include: { package: true }
                },
            },
        });
        // Generate Token
        const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role, clinicId: newUser.clinicId }, JWT_SECRET, { expiresIn: "7d" });
        return res.status(201).json({
            message: "Registration successful!",
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                fullName: newUser.fullName,
                role: newUser.role,
                clinic: newUser.clinic,
            },
        });
    }
    catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({ message: "Internal server error during registration" });
    }
};
exports.register = register;
// Login user
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        // Find user
        const user = await prisma_1.default.user.findUnique({
            where: { email },
            include: { clinic: true },
        });
        if (!user) {
            return res.status(401).json({ message: "Invalid email credentials" });
        }
        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password credentials" });
        }
        let permissions = null;
        if (user.role === "STAFF") {
            const staff = await prisma_1.default.staff.findFirst({
                where: { email, clinicId: user.clinicId || undefined }
            });
            if (staff?.role) {
                const clinicRole = await prisma_1.default.clinicRole.findFirst({
                    where: { name: staff.role, clinicId: user.clinicId || undefined }
                });
                if (clinicRole) {
                    permissions = clinicRole.permissions;
                }
            }
        }
        // Generate JWT
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId }, JWT_SECRET, { expiresIn: "7d" });
        return res.json({
            message: "Login successful!",
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                clinicId: user.clinicId,
                clinic: user.clinic,
                permissions
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Internal server error during login" });
    }
};
exports.login = login;
// Get current user profile
const getMe = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            include: { clinic: true },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        let permissions = null;
        if (user.role === "STAFF") {
            const staff = await prisma_1.default.staff.findFirst({
                where: { email: user.email, clinicId: user.clinicId || undefined }
            });
            if (staff?.role) {
                const clinicRole = await prisma_1.default.clinicRole.findFirst({
                    where: { name: staff.role, clinicId: user.clinicId || undefined }
                });
                if (clinicRole) {
                    permissions = clinicRole.permissions;
                }
            }
        }
        return res.json({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            clinic: user.clinic,
            permissions
        });
    }
    catch (error) {
        console.error("GetMe error:", error);
        return res.status(500).json({ message: "Internal server error retrieving profile" });
    }
};
exports.getMe = getMe;
