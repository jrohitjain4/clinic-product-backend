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
const phoneValidation_1 = require("../utils/phoneValidation");
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
        const { firstName, middleName, lastName, profileImage, phone, alternateMobile, email, dob, age, gender, bloodGroup, maritalStatus, occupation, aadhaarNumber, passportNumber, referredBy, emergencyContactName, emergencyContactRelation, emergencyContactPhone, status, address1, address2, country, state, city, pincode, lastVisitedAt, vitals, } = req.body;
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
        if (phone) {
            const duplicate = await (0, phoneValidation_1.checkPhoneDuplicate)(phone);
            if (duplicate) {
                return res.status(400).json({ message: "This phone number is already registered" });
            }
        }
        if (email) {
            const existingDuplicate = await prisma_1.default.patient.findFirst({
                where: {
                    clinicId,
                    email: email.toLowerCase()
                }
            });
            if (existingDuplicate) {
                return res.status(400).json({ message: "A patient with this email already exists." });
            }
        }
        const clinic = await prisma_1.default.clinic.findUnique({
            where: { id: clinicId },
            include: { package: true },
        });
        if (clinic?.package?.maxPatients) {
            const count = await prisma_1.default.patient.count({
                where: {
                    clinicId,
                    status: { not: "Deleted" }
                }
            });
            if (count >= clinic.package.maxPatients) {
                return res.status(400).json({
                    message: `Patient limit reached (${clinic.package.maxPatients}). Upgrade your plan.`,
                });
            }
        }
        // Fix Patient Code format to PAT000001
        const count = await prisma_1.default.patient.count({
            where: {
                clinicId,
                status: { not: "Deleted" }
            }
        });
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
                age: age ? parseInt(age.toString(), 10) : null,
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
            await (0, email_1.sendPatientRegistrationEmail)(email, firstName.trim(), patientCode, { username: phone || email, password: generatedPassword });
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
        const { firstName, middleName, lastName, profileImage, phone, alternateMobile, email, dob, age, gender, bloodGroup, maritalStatus, occupation, aadhaarNumber, passportNumber, referredBy, emergencyContactName, emergencyContactRelation, emergencyContactPhone, status, address1, address2, country, state, city, pincode, lastVisitedAt, vitals, suggestIPD, } = req.body;
        if (phone && phone !== existing.phone) {
            const duplicate = await (0, phoneValidation_1.checkPhoneDuplicate)(phone);
            if (duplicate) {
                return res.status(400).json({ message: "This phone number is already registered" });
            }
        }
        const updated = await prisma_1.default.patient.update({
            where: { id },
            data: {
                firstName: firstName !== undefined ? firstName.trim() : existing.firstName,
                middleName: middleName !== undefined ? (middleName ? middleName.trim() : null) : existing.middleName,
                lastName: lastName !== undefined ? lastName.trim() : existing.lastName,
                profileImage: profileImage !== undefined ? profileImage || null : existing.profileImage,
                phone: phone !== undefined ? phone || null : existing.phone,
                alternateMobile: alternateMobile !== undefined ? alternateMobile || null : existing.alternateMobile,
                email: email !== undefined ? email || null : existing.email,
                dob: dob !== undefined ? (dob ? new Date(dob) : null) : existing.dob,
                age: age !== undefined ? (age ? parseInt(age.toString(), 10) : null) : existing.age,
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
                suggestIPD: suggestIPD !== undefined ? suggestIPD : existing.suggestIPD,
                maritalStatus: maritalStatus !== undefined
                    ? maritalStatus && maritalStatus !== "Select"
                        ? maritalStatus
                        : null
                    : existing.maritalStatus,
                occupation: occupation !== undefined ? occupation || null : existing.occupation,
                aadhaarNumber: aadhaarNumber !== undefined ? aadhaarNumber || null : existing.aadhaarNumber,
                passportNumber: passportNumber !== undefined ? passportNumber || null : existing.passportNumber,
                referredBy: referredBy !== undefined ? referredBy || null : existing.referredBy,
                emergencyContactName: emergencyContactName !== undefined ? emergencyContactName || null : existing.emergencyContactName,
                emergencyContactRelation: emergencyContactRelation !== undefined ? emergencyContactRelation || null : existing.emergencyContactRelation,
                emergencyContactPhone: emergencyContactPhone !== undefined ? emergencyContactPhone || null : existing.emergencyContactPhone,
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
        // Step 1: Null out patientId on all related Appointments
        await prisma_1.default.appointment.updateMany({
            where: { patientId: id },
            data: { patientId: null }
        });
        // Step 2: Null out patientId on all related Prescriptions
        await prisma_1.default.prescription.updateMany({
            where: { patientId: id },
            data: { patientId: null }
        });
        // Step 3: Null out patientId on all related Invoices
        await prisma_1.default.invoice.updateMany({
            where: { patientId: id },
            data: { patientId: null }
        });
        // Step 4: Delete linked User account
        if (existing.email) {
            await prisma_1.default.user.deleteMany({ where: { email: existing.email } });
        }
        else if (existing.phone) {
            await prisma_1.default.user.deleteMany({ where: { phone: existing.phone } });
        }
        // Step 5: Hard delete the patient record
        await prisma_1.default.patient.delete({ where: { id } });
        // 🔔 Notify on patient removal
        try {
            await (0, notification_controller_1.createNotificationInternal)({
                clinicId: clinicId,
                type: "PATIENT_ADDED",
                title: "Patient Record Removed",
                message: `Patient ${existing.firstName} ${existing.lastName} (${existing.patientCode}) has been permanently removed.`,
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
