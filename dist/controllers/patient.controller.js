"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePatient = exports.updatePatient = exports.createPatient = exports.getPatientById = exports.getPatients = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_controller_1 = require("./notification.controller");
const mapStatusLabel = (status) => status === "Active" ? "Available" : "Unavailable";
const email_1 = require("../utils/email");
const normalizeStatus = (status) => {
    if (!status)
        return "Active";
    if (status === "Unavailable" || status === "Inactive")
        return "Inactive";
    return "Active";
};
const calcAge = (dob) => {
    if (!dob)
        return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate()))
        age--;
    return age;
};
const formatAgeGender = (dob, gender) => {
    const age = calcAge(dob);
    const g = gender && gender !== "Select" ? gender : null;
    if (age != null && g)
        return `${age}, ${g}`;
    if (age != null)
        return `${age}`;
    if (g)
        return g;
    return "—";
};
const formatAddressShort = (city, state) => {
    const parts = [city, state].filter((p) => p && p !== "Select");
    return parts.length ? parts.join(", ") : "—";
};
const formatFullAddress = (p) => [p.address1, p.address2, p.city, p.state, p.country, p.pincode]
    .filter((x) => x && x !== "Select")
    .join(", ") || "—";
const formatDateLabel = (iso) => {
    if (!iso)
        return "—";
    return iso.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};
const enrichPatient = (p) => ({
    ...p,
    fullName: `${p.firstName} ${p.lastName}`.trim(),
    statusLabel: mapStatusLabel(p.status),
    ageGenderLabel: formatAgeGender(p.dob, p.gender),
    addressShort: formatAddressShort(p.city, p.state),
    fullAddress: formatFullAddress(p),
    lastVisitLabel: formatDateLabel(p.lastVisitedAt),
});
// GET /api/patients
const getPatients = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { status, doctorId, search, sort } = req.query;
        const patients = await prisma_1.default.patient.findMany({
            where: {
                clinicId,
                status: status && typeof status === "string" ? status : { not: "Deleted" },
                ...(search && typeof search === "string"
                    ? {
                        OR: [
                            { firstName: { contains: search, mode: "insensitive" } },
                            { lastName: { contains: search, mode: "insensitive" } },
                            { email: { contains: search, mode: "insensitive" } },
                            { phone: { contains: search, mode: "insensitive" } },
                            { patientCode: { contains: search, mode: "insensitive" } },
                        ],
                    }
                    : {}),
            },
            orderBy: sort === "oldest"
                ? { createdAt: "asc" }
                : { createdAt: "desc" },
        });
        res.json(patients.map(enrichPatient));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.getPatients = getPatients;
// GET /api/patients/:id
const getPatientById = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const patient = await prisma_1.default.patient.findFirst({
            where: { id, clinicId: clinicId },
        });
        if (!patient)
            return res.status(404).json({ message: "Patient not found" });
        res.json(enrichPatient(patient));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.getPatientById = getPatientById;
// POST /api/patients
const createPatient = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { firstName, middleName, lastName, profileImage, phone, alternateMobile, email, dob, gender, bloodGroup, maritalStatus, occupation, aadhaarNumber, passportNumber, referredBy, emergencyContactName, emergencyContactRelation, emergencyContactPhone, status, address1, address2, country, state, city, pincode, lastVisitedAt, vitals, } = req.body;
        if (!firstName?.trim()) {
            return res.status(400).json({ message: "First name is required" });
        }
        if (!lastName?.trim()) {
            return res.status(400).json({ message: "Last name is required" });
        }
        if (!address1?.trim()) {
            return res.status(400).json({ message: "Address Line 1 is required" });
        }
        // 🔴 P0 Duplicate Patient Detection
        if (phone || email) {
            const duplicateWhere = [];
            if (phone)
                duplicateWhere.push({ phone });
            if (email)
                duplicateWhere.push({ email: email.toLowerCase() });
            const existingDuplicate = await prisma_1.default.patient.findFirst({
                where: {
                    clinicId,
                    OR: duplicateWhere
                }
            });
            if (existingDuplicate) {
                return res.status(400).json({ message: "A patient with this phone number or email already exists." });
            }
        }
        const clinic = await prisma_1.default.clinic.findUnique({
            where: { id: clinicId },
            include: { package: true },
        });
        if (clinic?.package?.maxPatients) {
            const count = await prisma_1.default.patient.count({ where: { clinicId } });
            if (count >= clinic.package.maxPatients) {
                return res.status(400).json({
                    message: `Patient limit reached (${clinic.package.maxPatients}). Upgrade your plan.`,
                });
            }
        }
        // Fix Patient Code format to PAT000001
        const count = await prisma_1.default.patient.count({ where: { clinicId } });
        const patientCode = `PAT${String(count + 1).padStart(6, "0")}`;
        const patient = await prisma_1.default.patient.create({
            data: {
                patientCode,
                firstName: firstName.trim(),
                middleName: middleName ? middleName.trim() : null,
                lastName: lastName.trim(),
                profileImage: profileImage || null,
                phone: phone || null,
                alternateMobile: alternateMobile || null,
                email: email ? email.toLowerCase() : null,
                dob: dob ? new Date(dob) : null,
                gender: gender && gender !== "Select" ? gender : null,
                bloodGroup: bloodGroup && bloodGroup !== "Select" ? bloodGroup : null,
                maritalStatus: maritalStatus && maritalStatus !== "Select" ? maritalStatus : null,
                occupation: occupation || null,
                aadhaarNumber: aadhaarNumber || null,
                passportNumber: passportNumber || null,
                referredBy: referredBy || null,
                emergencyContactName: emergencyContactName || null,
                emergencyContactRelation: emergencyContactRelation || null,
                emergencyContactPhone: emergencyContactPhone || null,
                status: normalizeStatus(status),
                address1: address1 || null,
                address2: address2 || null,
                country: country && country !== "Select" ? country : null,
                state: state && state !== "Select" ? state : null,
                city: city && city !== "Select" ? city : null,
                pincode: pincode || null,
                lastVisitedAt: lastVisitedAt ? new Date(lastVisitedAt) : null,
                vitals: vitals || {},
                clinicId,
            },
        });
        // Create User mapping using Phone and/or Email
        const loginIdentifier = phone || email;
        let generatedPassword = req.body.password || (0, crypto_1.randomBytes)(4).toString("hex");
        if (loginIdentifier) {
            // Check if user account already exists (by email/phone)
            const userCondition = [];
            if (email)
                userCondition.push({ email: email.toLowerCase() });
            if (phone)
                userCondition.push({ phone });
            const existingUser = await prisma_1.default.user.findFirst({
                where: { OR: userCondition }
            });
            if (!existingUser) {
                // Fallback email if only phone is provided
                const userEmail = email ? email.toLowerCase() : `pt_${phone}@docyori.local`;
                const passwordHash = await bcryptjs_1.default.hash(generatedPassword, 10);
                await prisma_1.default.user.create({
                    data: {
                        email: userEmail,
                        phone: phone || null,
                        username: phone || null,
                        passwordHash,
                        fullName: `${firstName.trim()} ${lastName.trim()}`,
                        role: "PATIENT",
                        clinicId,
                    }
                });
            }
        }
        // 🔴 P0 Email Notification with valid credentials
        if (email) {
            const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "http://localhost:5173";
            const loginUrl = `${frontendLink}/login`;
            const emailBody = `
         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
           <h2 style="color: #2c3e50;">Welcome to Docyori!</h2>
           <p>Dear <strong>${firstName.trim()}</strong>,</p>
           <p>You have been registered successfully as a patient with our clinic. Your Patient ID is <b style="color: #0d6efd;">${patientCode}</b>.</p>
           
           <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0d6efd;">
             <p style="margin-top: 0;"><strong>Your Login Credentials:</strong></p>
             <ul style="margin-bottom: 0;">
               <li>Username: <strong>${phone || email}</strong></li>
               <li>Password: <strong>${generatedPassword}</strong></li>
             </ul>
           </div>
           
           <p style="color: #dc3545; font-size: 14px; font-weight: bold;">
             ⚠️ Please Note: The password provided above is a temporary password. We strongly recommend changing it immediately after your first login for security reasons.
           </p>
           
           <div style="text-align: center; margin: 30px 0;">
             <a href="${loginUrl}" style="background-color: #0d6efd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
               Click here to Login
             </a>
           </div>
           
           <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
           <p style="font-size: 13px; color: #6c757d; margin: 0;">Please log in to the patient portal to view your appointments, prescriptions, and records.</p>
           <p style="font-size: 13px; color: #6c757d; margin: 5px 0 0 0;">Regards,<br/><strong>The Clinic Team</strong></p>
         </div>
       `;
            await (0, email_1.sendEmail)(email.toLowerCase(), "Welcome to our Clinic - Your Login Details", emailBody);
        }
        res.status(201).json(enrichPatient(patient));
        // 🔔 Notify admin: new patient registered
        try {
            await (0, notification_controller_1.createNotificationInternal)({
                clinicId,
                type: "PATIENT_ADDED",
                title: "New Patient Registered",
                message: `${firstName.trim()} ${lastName.trim()} (${patientCode}) has been registered.`,
                targetRole: "ALL",
                link: "/patients/patient-list",
            });
        }
        catch (_) { /* non-blocking */ }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.createPatient = createPatient;
// PUT /api/patients/:id
const updatePatient = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.patient.findFirst({
            where: { id, clinicId: clinicId },
        });
        if (!existing)
            return res.status(404).json({ message: "Patient not found" });
        const { firstName, lastName, profileImage, phone, email, dob, gender, bloodGroup, status, address1, address2, country, state, city, pincode, lastVisitedAt, vitals, } = req.body;
        const updated = await prisma_1.default.patient.update({
            where: { id },
            data: {
                firstName: firstName !== undefined ? firstName.trim() : existing.firstName,
                lastName: lastName !== undefined ? lastName.trim() : existing.lastName,
                profileImage: profileImage !== undefined ? profileImage || null : existing.profileImage,
                phone: phone !== undefined ? phone || null : existing.phone,
                email: email !== undefined ? email || null : existing.email,
                dob: dob !== undefined ? (dob ? new Date(dob) : null) : existing.dob,
                gender: gender !== undefined
                    ? gender && gender !== "Select"
                        ? gender
                        : null
                    : existing.gender,
                bloodGroup: bloodGroup !== undefined
                    ? bloodGroup && bloodGroup !== "Select"
                        ? bloodGroup
                        : null
                    : existing.bloodGroup,
                status: status !== undefined ? normalizeStatus(status) : existing.status,
                address1: address1 !== undefined ? address1 || null : existing.address1,
                address2: address2 !== undefined ? address2 || null : existing.address2,
                country: country !== undefined
                    ? country && country !== "Select"
                        ? country
                        : null
                    : existing.country,
                state: state !== undefined
                    ? state && state !== "Select"
                        ? state
                        : null
                    : existing.state,
                city: city !== undefined
                    ? city && city !== "Select"
                        ? city
                        : null
                    : existing.city,
                pincode: pincode !== undefined ? pincode || null : existing.pincode,
                vitals: vitals !== undefined ? vitals : existing.vitals,
                lastVisitedAt: lastVisitedAt !== undefined
                    ? lastVisitedAt
                        ? new Date(lastVisitedAt)
                        : null
                    : existing.lastVisitedAt,
            },
        });
        res.json(enrichPatient(updated));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.updatePatient = updatePatient;
// DELETE /api/patients/:id
const deletePatient = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.patient.findFirst({
            where: { id, clinicId: clinicId },
        });
        if (!existing)
            return res.status(404).json({ message: "Patient not found" });
        // SOFT DELETE: Just change the status to "Deleted" instead of removing the record
        // This keeps the Appointments intact as requested.
        await prisma_1.default.patient.update({
            where: { id },
            data: { status: "Deleted" }
        });
        // 🔔 Notify on patient removal
        try {
            await (0, notification_controller_1.createNotificationInternal)({
                clinicId: clinicId,
                type: "PATIENT_ADDED",
                title: "Patient Record Removed",
                message: `Patient ${existing.firstName} ${existing.lastName} (${existing.patientCode}) has been removed.`,
                targetRole: "ADMIN",
                link: "/patients/patient-list",
            });
        }
        catch (_) { /* non-blocking */ }
        res.json({ message: "Patient deleted successfully" });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.deletePatient = deletePatient;
