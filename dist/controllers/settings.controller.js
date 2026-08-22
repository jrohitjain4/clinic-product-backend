"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateIPDAdmissionFee = exports.getIPDAdmissionFee = exports.updateWorkingDaysConfig = exports.getWorkingDaysConfig = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getWorkingDaysConfig = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "Clinic not found" });
        let config = await prisma_1.default.workingDaysConfig.findUnique({
            where: { clinicId }
        });
        if (!config) {
            const initialSchedules = [0, 1, 2, 3, 4, 5, 6].map(d => ({
                day: d,
                startTime: "09:00",
                endTime: "18:00",
                isActive: d !== 0 // Sunday off by default
            }));
            config = await prisma_1.default.workingDaysConfig.create({
                data: {
                    clinicId,
                    offDays: [0],
                    schedules: initialSchedules
                }
            });
        }
        else if (!config.schedules || (Array.isArray(config.schedules) && config.schedules.length === 0)) {
            // Migrating existing config to include schedules
            const schedules = [0, 1, 2, 3, 4, 5, 6].map(d => ({
                day: d,
                startTime: "09:00",
                endTime: "18:00",
                isActive: !config?.offDays.includes(d)
            }));
            config = await prisma_1.default.workingDaysConfig.update({
                where: { id: config.id },
                data: { schedules }
            });
        }
        res.json(config);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getWorkingDaysConfig = getWorkingDaysConfig;
const updateWorkingDaysConfig = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "Clinic not found" });
        const { offDays, schedules } = req.body;
        const updateData = {};
        if (Array.isArray(offDays))
            updateData.offDays = offDays;
        if (schedules)
            updateData.schedules = schedules;
        const config = await prisma_1.default.workingDaysConfig.upsert({
            where: { clinicId },
            create: {
                clinicId,
                offDays: offDays || [0],
                schedules: schedules || []
            },
            update: updateData
        });
        res.json(config);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateWorkingDaysConfig = updateWorkingDaysConfig;
const getIPDAdmissionFee = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "Clinic not found" });
        const clinic = await prisma_1.default.clinic.findUnique({
            where: { id: clinicId },
            select: { ipdAdmissionFee: true }
        });
        if (!clinic)
            return res.status(404).json({ message: "Clinic not found" });
        res.json({ ipdAdmissionFee: clinic.ipdAdmissionFee });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getIPDAdmissionFee = getIPDAdmissionFee;
const updateIPDAdmissionFee = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "Clinic not found" });
        const { ipdAdmissionFee } = req.body;
        if (ipdAdmissionFee === undefined || isNaN(parseFloat(ipdAdmissionFee))) {
            return res.status(400).json({ message: "Valid admission fee is required" });
        }
        const clinic = await prisma_1.default.clinic.update({
            where: { id: clinicId },
            data: { ipdAdmissionFee: parseFloat(ipdAdmissionFee) },
            select: { ipdAdmissionFee: true }
        });
        res.json({ message: "Admission fee saved successfully", ipdAdmissionFee: clinic.ipdAdmissionFee });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateIPDAdmissionFee = updateIPDAdmissionFee;
