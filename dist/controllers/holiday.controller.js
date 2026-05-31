"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteHoliday = exports.updateHoliday = exports.createHoliday = exports.getHolidays = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/holidays
const getHolidays = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const holidays = await prisma_1.default.holiday.findMany({
            where: { clinicId },
            orderBy: { date: "asc" },
        });
        res.json(holidays);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getHolidays = getHolidays;
// POST /api/holidays — supports optional endDate for range
const createHoliday = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { title, description, date, endDate, dayName } = req.body;
        if (!title || !date)
            return res.status(400).json({ message: "Title and Date are required" });
        // Create single record with optional endDate
        const newHoliday = await prisma_1.default.holiday.create({
            data: {
                title,
                description: description || null,
                date: new Date(date),
                endDate: endDate ? new Date(endDate) : null,
                dayName: dayName || null,
                clinicId,
            },
        });
        res.status(201).json(newHoliday);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createHoliday = createHoliday;
// PUT /api/holidays/:id
const updateHoliday = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { title, description, date, endDate, dayName } = req.body;
        const existing = await prisma_1.default.holiday.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Holiday not found" });
        const updated = await prisma_1.default.holiday.update({
            where: { id },
            data: {
                title,
                description,
                date: date ? new Date(date) : undefined,
                endDate: endDate ? new Date(endDate) : null,
                dayName
            },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateHoliday = updateHoliday;
// DELETE /api/holidays/:id
const deleteHoliday = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.holiday.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Holiday not found" });
        await prisma_1.default.holiday.delete({ where: { id } });
        res.json({ message: "Holiday deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteHoliday = deleteHoliday;
