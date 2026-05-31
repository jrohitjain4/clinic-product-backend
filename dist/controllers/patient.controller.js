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
const doctorInclude = {
    primaryDoctor: {
        select: {
            id: true,
            fullName: true,
            profileImage: true,
            designation: { select: { id: true, name: true } },
        },
    },
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
                ...(status && typeof status === "string" ? { status } : {}),
                ...(doctorId && typeof doctorId === "string"
                    ? { primaryDoctorId: doctorId }
                    : {}),
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
            include: doctorInclude,
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
            include: doctorInclude,
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
        const { firstName, lastName, profileImage, phone, email, dob, gender, bloodGroup, status, address1, address2, country, state, city, pincode, primaryDoctorId, lastVisitedAt, } = req.body;
        if (!firstName?.trim()) {
            return res.status(400).json({ message: "First name is required" });
        }
        if (!lastName?.trim()) {
            return res.status(400).json({ message: "Last name is required" });
        }
        if (!primaryDoctorId) {
            return res.status(400).json({ message: "Primary doctor is required" });
        }
        const doctor = await prisma_1.default.doctor.findFirst({
            where: { id: primaryDoctorId, clinicId },
        });
        if (!doctor) {
            return res.status(400).json({ message: "Invalid primary doctor" });
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
        // Fetch current count safely — use UUID suffix to prevent code collision on race condition
        const count = await prisma_1.default.patient.count({ where: { clinicId } });
        const patientCode = `PT${String(count + 1).padStart(4, "0")}-${(0, crypto_1.randomBytes)(2).toString("hex").toUpperCase()}`;
        const patient = await prisma_1.default.patient.create({
            data: {
                patientCode,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                profileImage: profileImage || null,
                phone: phone || null,
                email: email || null,
                dob: dob ? new Date(dob) : null,
                gender: gender && gender !== "Select" ? gender : null,
                bloodGroup: bloodGroup && bloodGroup !== "Select" ? bloodGroup : null,
                status: normalizeStatus(status),
                address1: address1 || null,
                address2: address2 || null,
                country: country && country !== "Select" ? country : null,
                state: state && state !== "Select" ? state : null,
                city: city && city !== "Select" ? city : null,
                pincode: pincode || null,
                primaryDoctorId,
                lastVisitedAt: lastVisitedAt ? new Date(lastVisitedAt) : null,
                clinicId,
            },
            include: doctorInclude,
        });
        if (email) {
            const existingUser = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase() } });
            if (!existingUser) {
                const temporaryPassword = req.body.password || "patient123";
                const passwordHash = await bcryptjs_1.default.hash(temporaryPassword, 10);
                await prisma_1.default.user.create({
                    data: {
                        email: email.toLowerCase(),
                        passwordHash,
                        fullName: `${firstName.trim()} ${lastName.trim()}`,
                        role: "PATIENT",
                        clinicId,
                    }
                });
            }
        }
        res.status(201).json(enrichPatient(patient));
        // 🔔 Notify admin: new patient registered
        try {
            await (0, notification_controller_1.createNotificationInternal)({
                clinicId,
                type: "PATIENT_ADDED",
                title: "New Patient Registered",
                message: `${firstName.trim()} ${lastName.trim()} (${patientCode}) has been registered${doctor ? ` under Dr. ${doctor.fullName}` : ""}.`,
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
        const { firstName, lastName, profileImage, phone, email, dob, gender, bloodGroup, status, address1, address2, country, state, city, pincode, primaryDoctorId, lastVisitedAt, } = req.body;
        if (primaryDoctorId) {
            const doctor = await prisma_1.default.doctor.findFirst({
                where: { id: primaryDoctorId, clinicId: clinicId },
            });
            if (!doctor) {
                return res.status(400).json({ message: "Invalid primary doctor" });
            }
        }
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
                primaryDoctorId: primaryDoctorId !== undefined ? primaryDoctorId || null : existing.primaryDoctorId,
                lastVisitedAt: lastVisitedAt !== undefined
                    ? lastVisitedAt
                        ? new Date(lastVisitedAt)
                        : null
                    : existing.lastVisitedAt,
            },
            include: doctorInclude,
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
        await prisma_1.default.patient.delete({ where: { id } });
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
