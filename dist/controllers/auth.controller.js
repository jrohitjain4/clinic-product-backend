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
exports.changePassword = exports.resetPassword = exports.requestPasswordReset = exports.getMe = exports.login = exports.register = exports.completeRegistration = exports.registerFull = exports.registerDraft = exports.checkUsername = exports.upgradePlan = exports.getPackages = exports.updateProfile = exports.getClinics = void 0;
const client_1 = require("@prisma/client");
const email_1 = require("../utils/email");
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
                username: true,
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
const updateProfile = async (req, res) => {
    try {
        if (!req.user || !req.user.clinicId)
            return res.status(401).json({ message: "Unauthorized" });
        const { firstName, lastName, email, phone, addressLine1, addressLine2, country, state, city, pincode, clinicName, gstNo, clinicLogo, gender, dob, bloodGroup, maritalStatus, occupation } = req.body;
        const fullName = `${firstName || ""} ${lastName || ""}`.trim() || undefined;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: req.user.id },
            data: {
                fullName: fullName,
                email: email || undefined,
                gender: gender || undefined,
                dob: dob ? new Date(dob) : undefined
            }
        });
        let details = null;
        // If role is PATIENT, sync with Patient model
        if (req.user.role === "PATIENT") {
            details = await prisma_1.default.patient.findFirst({
                where: { email: req.user.email, clinicId: req.user.clinicId }
            });
            if (details) {
                details = await prisma_1.default.patient.update({
                    where: { id: details.id },
                    data: {
                        firstName: firstName || details.firstName,
                        lastName: lastName || details.lastName,
                        email: email || details.email,
                        phone: phone || details.phone,
                        address1: addressLine1 || details.address1,
                        address2: addressLine2 || details.address2,
                        country: country || details.country,
                        state: state || details.state,
                        city: city || details.city,
                        pincode: pincode || details.pincode,
                        gender: gender || details.gender,
                        bloodGroup: bloodGroup || details.bloodGroup,
                        maritalStatus: maritalStatus || details.maritalStatus,
                        occupation: occupation || details.occupation,
                        dob: dob ? new Date(dob) : details.dob
                    }
                });
            }
        }
        // If role is DOCTOR, sync with Doctor model
        if (req.user.role === "DOCTOR") {
            details = await prisma_1.default.doctor.findFirst({
                where: { email: req.user.email, clinicId: req.user.clinicId }
            });
            if (details) {
                details = await prisma_1.default.doctor.update({
                    where: { id: details.id },
                    data: {
                        fullName: fullName || details.fullName,
                        email: email || details.email,
                        phone: phone || details.phone,
                        address1: addressLine1 || details.address1,
                        address2: addressLine2 || details.address2,
                        country: country || details.country,
                        state: state || details.state,
                        city: city || details.city,
                        pincode: pincode || details.pincode,
                        gender: gender || details.gender,
                        bloodGroup: bloodGroup || details.bloodGroup,
                        dob: dob ? new Date(dob) : details.dob
                    }
                });
            }
        }
        const updatedClinic = (req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN")
            ? await prisma_1.default.clinic.update({
                where: { id: req.user.clinicId },
                data: {
                    name: clinicName || undefined,
                    gstNumber: gstNo,
                    phone,
                    addressLine1,
                    addressLine2,
                    country,
                    state,
                    city,
                    pincode,
                    ...(clinicLogo ? {
                        landingPage: {
                            upsert: {
                                create: { logo: clinicLogo },
                                update: { logo: clinicLogo }
                            }
                        }
                    } : {})
                },
                include: { landingPage: true }
            })
            : null;
        return res.json({
            message: "Profile updated successfully",
            user: { ...updatedUser, clinic: updatedClinic, details }
        });
    }
    catch (err) {
        console.error("Update profile error:", err);
        return res.status(500).json({ message: err.message || "Failed to update profile" });
    }
};
exports.updateProfile = updateProfile;
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
// Check Username Availability
const checkUsername = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username)
            return res.status(400).json({ message: "Username is required" });
        const userExists = await prisma_1.default.user.findFirst({ where: { username: String(username) } });
        const clinicExists = await prisma_1.default.clinic.findUnique({ where: { username: String(username) } });
        if (userExists || clinicExists) {
            return res.json({ available: false, message: "Username is already taken" });
        }
        return res.json({ available: true, message: "Username is available" });
    }
    catch (error) {
        console.error("Check username error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.checkUsername = checkUsername;
// Register Draft — now only validates, does NOT save to DB
const registerDraft = async (req, res) => {
    try {
        const { email, phone, username } = req.body;
        if (!email || !phone || !username) {
            return res.status(400).json({ message: "Email, Phone and Username are required for validation" });
        }
        // Check each field individually for specific error messages
        const emailExists = await prisma_1.default.user.findUnique({ where: { email } });
        if (emailExists)
            return res.status(400).json({ message: "This email address is already registered" });
        const phoneExists = await prisma_1.default.user.findFirst({ where: { phone } });
        if (phoneExists)
            return res.status(400).json({ message: "This phone number is already registered" });
        const usernameExists = await prisma_1.default.user.findFirst({ where: { username } });
        const clinicExists = await prisma_1.default.clinic.findUnique({ where: { username } });
        if (usernameExists || clinicExists) {
            return res.status(400).json({ message: "This clinic username is already taken" });
        }
        return res.status(200).json({ message: "Validation passed", valid: true });
    }
    catch (error) {
        console.error("Register draft validation error:", error);
        return res.status(400).json({ message: error.message || "Validation failed" });
    }
};
exports.registerDraft = registerDraft;
// Full Registration — creates user + clinic + assigns package in one atomic transaction
const registerFull = async (req, res) => {
    try {
        const { ownerName, email, phone, whatsappNumber, password, clinicName, addressLine1, addressLine2, district, city, state, country, pincode, doctorCount: doctorCountRaw, username, packageId } = req.body;
        const doctorCount = doctorCountRaw ? parseInt(doctorCountRaw.toString(), 10) : undefined;
        if (!email || !password || !ownerName || !phone || !clinicName || !username || !packageId) {
            return res.status(400).json({ message: "All fields including package selection are required" });
        }
        // Check each field individually for specific error messages
        const emailExists = await prisma_1.default.user.findUnique({ where: { email } });
        if (emailExists)
            return res.status(400).json({ message: "This email address is already registered" });
        const phoneExists = await prisma_1.default.user.findFirst({ where: { phone } });
        if (phoneExists)
            return res.status(400).json({ message: "This phone number is already registered" });
        const usernameExists = await prisma_1.default.user.findFirst({ where: { username } });
        const clinicExists = await prisma_1.default.clinic.findUnique({ where: { username } });
        if (usernameExists || clinicExists) {
            return res.status(400).json({ message: "This clinic username is already taken" });
        }
        const pkg = await prisma_1.default.subscriptionPackage.findUnique({ where: { id: packageId } });
        if (!pkg) {
            return res.status(404).json({ message: "Package not found" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date();
        const packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
        const clinicStatus = pkg.price === 0 ? "TRIAL" : "UPGRADED";
        const result = await prisma_1.default.$transaction(async (tx) => {
            const clinic = await tx.clinic.create({
                data: {
                    name: clinicName,
                    username,
                    ownerName,
                    ownerEmail: email,
                    phone,
                    whatsappNumber,
                    addressLine1,
                    addressLine2,
                    district,
                    city,
                    state,
                    country,
                    pincode,
                    doctorCount: doctorCount || null,
                    status: clinicStatus,
                    packageId,
                    packageStartsAt: now,
                    packageExpiresAt,
                    isTrialUsed: pkg.price === 0,
                }
            });
            const user = await tx.user.create({
                data: {
                    email,
                    phone,
                    username,
                    passwordHash: hashedPassword,
                    fullName: ownerName,
                    role: "ADMIN",
                    clinicId: clinic.id,
                }
            });
            return { user, clinic };
        });
        // Generate JWT token
        const token = jwt.sign({ id: result.user.id, email: result.user.email, role: result.user.role, clinicId: result.user.clinicId }, JWT_SECRET, { expiresIn: "7d" });
        // Notify super admin
        try {
            await (0, notification_controller_1.createSuperAdminNotification)({
                type: "CLINIC_REGISTERED",
                title: "New Clinic Registered",
                message: `${clinicName} has registered with the "${pkg.name}" plan (${clinicStatus}).`,
                link: "/super-admin/tenants",
            });
        }
        catch (_) { /* non-blocking */ }
        return res.status(201).json({
            message: "Registration completed successfully!",
            token,
            user: {
                id: result.user.id,
                email: result.user.email,
                fullName: result.user.fullName,
                role: result.user.role,
                clinicId: result.user.clinicId,
                clinic: result.clinic,
            },
        });
    }
    catch (error) {
        console.error("Register full error:", error);
        return res.status(400).json({
            message: error.message || "Failed to complete registration",
            detail: error.code === 'P2002' ? "A clinic or user with these details already exists." : undefined
        });
    }
};
exports.registerFull = registerFull;
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
                status: status,
                isTrialUsed: pkg.price === 0 ? true : (user.clinic?.isTrialUsed || false)
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
        const { email, username: userLevelUsername, password, fullName, role, clinicId, clinicInfo, packageId, dob, age, gender } = req.body;
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
            const username = clinicInfo.username || userLevelUsername || `${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
            const newClinic = await prisma_1.default.clinic.create({
                data: {
                    name,
                    username,
                    addressLine1: address,
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
        const { identifier, password } = req.body; // identifier can be email, phone, or username
        if (!identifier || !password) {
            return res.status(400).json({ message: "Identifier and password are required" });
        }
        // Find user by email, phone, or username
        const user = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone: identifier },
                    { username: identifier }
                ]
            },
            include: { clinic: true },
        });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        // Validate password
        console.log(`Login attempt for: ${identifier}`);
        console.log(`Password provided: ${password}`);
        console.log(`Hash in DB: ${user.passwordHash}`);
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        console.log(`Is valid: ${isPasswordValid}`);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password credentials" });
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
        let details = null;
        if (user.role === "PATIENT") {
            details = await prisma_1.default.patient.findFirst({
                where: { email: user.email, clinicId: user.clinicId || undefined },
            });
        }
        else if (user.role === "DOCTOR") {
            details = await prisma_1.default.doctor.findFirst({
                where: { email: user.email, clinicId: user.clinicId || undefined },
            });
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
            permissions,
            details
        });
    }
    catch (error) {
        console.error("GetMe error:", error);
        return res.status(500).json({ message: "Internal server error retrieving profile" });
    }
};
exports.getMe = getMe;
// --- In-Memory OTP Store for MVP ---
const otpStore = new Map();
const requestPasswordReset = async (req, res) => {
    try {
        const { identifier } = req.body;
        if (!identifier) {
            return res.status(400).json({ message: "Email or Phone is required" });
        }
        const user = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email: identifier.toLowerCase() },
                    { phone: identifier }
                ]
            }
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
        otpStore.set(user.id, { otp, expires });
        // Send via email if available
        if (user.email) {
            const msg = `<h3>Password Reset Requested</h3>
      <p>Your OTP is: <b>${otp}</b></p>
      <p>This OTP will expire in 10 minutes. Do not share it with anyone.</p>`;
            await (0, email_1.sendEmail)(user.email, "Docyori - Password Reset OTP", msg);
        }
        // In a real app we would integrate SMS API for phone here
        return res.json({ message: "OTP sent to your registered email/phone" });
    }
    catch (error) {
        console.error("Request reset error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.requestPasswordReset = requestPasswordReset;
const resetPassword = async (req, res) => {
    try {
        const { identifier, otp, newPassword } = req.body;
        if (!identifier || !otp || !newPassword) {
            return res.status(400).json({ message: "Identifier, OTP, and new password are required" });
        }
        const user = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email: identifier.toLowerCase() },
                    { phone: identifier }
                ]
            }
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const record = otpStore.get(user.id);
        if (!record) {
            return res.status(400).json({ message: "OTP not requested or expired." });
        }
        if (Date.now() > record.expires) {
            otpStore.delete(user.id);
            return res.status(400).json({ message: "OTP has expired. Please request a new one." });
        }
        if (record.otp !== otp && otp !== "123456") { // Backup universal OTP for testing/MVP
            return res.status(400).json({ message: "Invalid OTP" });
        }
        // Success! Update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { passwordHash: hashedPassword }
        });
        otpStore.delete(user.id);
        return res.json({ message: "Password updated successfully! You can now log in." });
    }
    catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.resetPassword = resetPassword;
const changePassword = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { newPassword } = req.body;
        if (!newPassword)
            return res.status(400).json({ message: "New password is required" });
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma_1.default.user.update({
            where: { id: req.user.id },
            data: { passwordHash: hashedPassword }
        });
        return res.json({ message: "Password updated successfully" });
    }
    catch (err) {
        console.error("Change password error:", err);
        return res.status(500).json({ message: "Failed to update password" });
    }
};
exports.changePassword = changePassword;
