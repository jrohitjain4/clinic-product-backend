"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSearch = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const globalSearch = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const role = req.user?.role;
        const doctorId = req.user?.doctorId;
        const patientId = req.user?.patientId;
        const q = req.query.q;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        if (!q || q.trim() === "") {
            return res.json({ patients: [], doctors: [], appointments: [] });
        }
        const searchTerm = q.trim();
        // ── DOCTOR: only their patients & appointments ──
        if (role === "DOCTOR" && doctorId) {
            // Get patient IDs from this doctor's appointments
            const appts = await prisma_1.default.appointment.findMany({
                where: { clinicId, doctorId },
                select: { patientId: true, id: true, appointmentCode: true, scheduledAt: true, patient: { select: { firstName: true, lastName: true } } }
            });
            const patientIds = [...new Set(appts.map(a => a.patientId))];
            const [patients, appointments] = await Promise.all([
                prisma_1.default.patient.findMany({
                    where: {
                        clinicId,
                        id: { in: patientIds },
                        status: { not: "Deleted" },
                        OR: [
                            { firstName: { contains: searchTerm, mode: "insensitive" } },
                            { lastName: { contains: searchTerm, mode: "insensitive" } },
                            { patientCode: { contains: searchTerm, mode: "insensitive" } },
                        ],
                    },
                    take: 5,
                    select: { id: true, firstName: true, lastName: true, patientCode: true, profileImage: true },
                }),
                prisma_1.default.appointment.findMany({
                    where: {
                        clinicId,
                        doctorId,
                        appointmentCode: { contains: searchTerm, mode: "insensitive" },
                    },
                    take: 5,
                    select: { id: true, appointmentCode: true, scheduledAt: true, patient: { select: { firstName: true, lastName: true } } },
                }),
            ]);
            return res.json({ patients, doctors: [], appointments });
        }
        // ── PATIENT: only their doctor & appointments ──
        if (role === "PATIENT" && patientId) {
            const [doctors, appointments] = await Promise.all([
                prisma_1.default.doctor.findMany({
                    where: {
                        clinicId,
                        appointments: { some: { patientId } },
                        OR: [
                            { fullName: { contains: searchTerm, mode: "insensitive" } },
                            { doctorCode: { contains: searchTerm, mode: "insensitive" } },
                        ],
                    },
                    take: 5,
                    select: { id: true, fullName: true, doctorCode: true, profileImage: true },
                }),
                prisma_1.default.appointment.findMany({
                    where: {
                        clinicId,
                        patientId,
                        appointmentCode: { contains: searchTerm, mode: "insensitive" },
                    },
                    take: 5,
                    select: { id: true, appointmentCode: true, scheduledAt: true, patient: { select: { firstName: true, lastName: true } } },
                }),
            ]);
            return res.json({ patients: [], doctors, appointments });
        }
        // ── ADMIN / STAFF: full clinic search ──
        const [patients, doctors, appointments] = await Promise.all([
            prisma_1.default.patient.findMany({
                where: {
                    clinicId,
                    status: { not: "Deleted" },
                    OR: [
                        { firstName: { contains: searchTerm, mode: "insensitive" } },
                        { lastName: { contains: searchTerm, mode: "insensitive" } },
                        { patientCode: { contains: searchTerm, mode: "insensitive" } },
                    ],
                },
                take: 5,
                select: { id: true, firstName: true, lastName: true, patientCode: true, profileImage: true },
            }),
            prisma_1.default.doctor.findMany({
                where: {
                    clinicId,
                    OR: [
                        { fullName: { contains: searchTerm, mode: "insensitive" } },
                        { doctorCode: { contains: searchTerm, mode: "insensitive" } },
                    ],
                },
                take: 5,
                select: { id: true, fullName: true, doctorCode: true, profileImage: true },
            }),
            prisma_1.default.appointment.findMany({
                where: {
                    clinicId,
                    appointmentCode: { contains: searchTerm, mode: "insensitive" },
                },
                take: 5,
                select: { id: true, appointmentCode: true, scheduledAt: true, patient: { select: { firstName: true, lastName: true } } },
            }),
        ]);
        res.json({ patients, doctors, appointments });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.globalSearch = globalSearch;
