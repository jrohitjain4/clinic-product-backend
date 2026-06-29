"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteLabTests = exports.deleteLabTest = exports.updateLabTest = exports.createLabTest = exports.getLabTests = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/lab-tests
const getLabTests = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        let tests = await prisma_1.default.labTest.findMany({
            where: { clinicId },
            include: { category: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
        });
        if (req.user?.role === "DOCTOR" && req.user?.doctorId) {
            const docId = req.user.doctorId;
            tests = tests.filter(t => {
                const doctors = Array.isArray(t.assignedDoctors) ? t.assignedDoctors : [];
                return doctors.includes(docId);
            });
        }
        res.json(tests);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getLabTests = getLabTests;
// POST /api/lab-tests
const createLabTest = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { name, shortName, testCode, description, price, homeCollectionCharge, duration, preparationInfo, assignment, status, categoryId, schedules, isSlotBookingEnabled, slotDuration, maxBookingsPerSlot, assignedDoctors, assignedStaff } = req.body;
        if (!name)
            return res.status(400).json({ message: "Test name is required" });
        const generatedTestCode = testCode || `TEST-${Math.floor(100000 + Math.random() * 900000)}`;
        const test = await prisma_1.default.labTest.create({
            data: {
                name,
                shortName: shortName || null,
                testCode: generatedTestCode,
                description: description || "",
                price: parseFloat(price) || 0,
                homeCollectionCharge: parseFloat(homeCollectionCharge) || 0,
                duration: duration || null,
                preparationInfo: preparationInfo || null,
                assignment: assignment || "Staff",
                status: status || "Active",
                schedules: schedules || [],
                isSlotBookingEnabled: Boolean(isSlotBookingEnabled),
                slotDuration: isSlotBookingEnabled ? parseInt(slotDuration) || null : null,
                maxBookingsPerSlot: isSlotBookingEnabled ? parseInt(maxBookingsPerSlot) || null : null,
                assignedDoctors: assignedDoctors || [],
                assignedStaff: assignedStaff || [],
                categoryId: categoryId || null,
                clinicId,
            },
            include: { category: { select: { id: true, name: true } } },
        });
        res.status(201).json(test);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createLabTest = createLabTest;
// PUT /api/lab-tests/:id
const updateLabTest = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.labTest.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Test not found" });
        const { name, shortName, description, price, homeCollectionCharge, duration, preparationInfo, assignment, status, categoryId, schedules, isSlotBookingEnabled, slotDuration, maxBookingsPerSlot, assignedDoctors, assignedStaff } = req.body;
        const updated = await prisma_1.default.labTest.update({
            where: { id },
            data: {
                name,
                shortName,
                description,
                price: price !== undefined ? parseFloat(price) : undefined,
                homeCollectionCharge: homeCollectionCharge !== undefined ? parseFloat(homeCollectionCharge) : undefined,
                duration,
                preparationInfo,
                assignment,
                status,
                schedules,
                isSlotBookingEnabled: isSlotBookingEnabled !== undefined ? Boolean(isSlotBookingEnabled) : undefined,
                slotDuration: isSlotBookingEnabled ? parseInt(slotDuration) || null : null,
                maxBookingsPerSlot: isSlotBookingEnabled ? parseInt(maxBookingsPerSlot) || null : null,
                assignedDoctors: assignedDoctors !== undefined ? assignedDoctors : undefined,
                assignedStaff: assignedStaff !== undefined ? assignedStaff : undefined,
                categoryId: categoryId || null,
            },
            include: { category: { select: { id: true, name: true } } },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateLabTest = updateLabTest;
// DELETE /api/lab-tests/:id
const deleteLabTest = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.labTest.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Test not found" });
        await prisma_1.default.labTest.delete({ where: { id } });
        res.json({ message: "Test deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteLabTest = deleteLabTest;
// DELETE /api/lab-tests/bulk
const bulkDeleteLabTests = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "ids array is required" });
        }
        await prisma_1.default.labTest.deleteMany({
            where: { id: { in: ids }, clinicId },
        });
        res.json({ message: `${ids.length} tests deleted successfully` });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.bulkDeleteLabTests = bulkDeleteLabTests;
