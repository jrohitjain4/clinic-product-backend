"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMedicineStock = exports.bulkDeleteMedicines = exports.deleteMedicine = exports.updateMedicine = exports.createMedicine = exports.getMedicineById = exports.getMedicines = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/medicines
const getMedicines = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const medicines = await prisma_1.default.medicine.findMany({
            where: { clinicId },
            include: { category: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json(medicines);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getMedicines = getMedicines;
// GET /api/medicines/:id
const getMedicineById = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const medicine = await prisma_1.default.medicine.findFirst({
            where: { id, clinicId: clinicId },
            include: { category: { select: { id: true, name: true } } },
        });
        if (!medicine)
            return res.status(404).json({ message: "Medicine not found" });
        res.json(medicine);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getMedicineById = getMedicineById;
// POST /api/medicines
const createMedicine = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { medicineName, genericName, brandName, categoryId, manufacturer, medicineCode, hsnCode, description, purchasePrice, sellingPrice, gst, mrp, openingStock, minimumStockAlert, unit, batchNumber, manufacturingDate, expiryDate, prescriptionRequired, status, } = req.body;
        if (!medicineName)
            return res.status(400).json({ message: "Medicine name is required" });
        const autoCode = medicineCode || `MED-${Math.floor(100000 + Math.random() * 900000)}`;
        const parsedOpeningStock = parseInt(openingStock) || 0;
        const medicine = await prisma_1.default.medicine.create({
            data: {
                medicineName,
                genericName: genericName || null,
                brandName: brandName || null,
                categoryId: categoryId || null,
                manufacturer: manufacturer || null,
                medicineCode: autoCode,
                hsnCode: hsnCode || null,
                description: description || null,
                purchasePrice: parseFloat(purchasePrice) || 0,
                sellingPrice: parseFloat(sellingPrice) || 0,
                gst: parseFloat(gst) || 0,
                mrp: parseFloat(mrp) || 0,
                openingStock: parsedOpeningStock,
                stockIn: parsedOpeningStock,
                stockOut: 0,
                minimumStockAlert: parseInt(minimumStockAlert) || 0,
                unit: unit || null,
                batchNumber: batchNumber || null,
                manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                prescriptionRequired: prescriptionRequired === true || prescriptionRequired === "true",
                status: status || "Active",
                clinicId,
            },
            include: { category: { select: { id: true, name: true } } },
        });
        res.status(201).json(medicine);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createMedicine = createMedicine;
// PUT /api/medicines/:id
const updateMedicine = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.medicine.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Medicine not found" });
        const { medicineName, genericName, brandName, categoryId, manufacturer, medicineCode, hsnCode, description, purchasePrice, sellingPrice, gst, mrp, openingStock, minimumStockAlert, unit, batchNumber, manufacturingDate, expiryDate, prescriptionRequired, status, } = req.body;
        const updated = await prisma_1.default.medicine.update({
            where: { id },
            data: {
                medicineName,
                genericName: genericName ?? null,
                brandName: brandName ?? null,
                categoryId: categoryId || null,
                manufacturer: manufacturer ?? null,
                medicineCode: medicineCode || existing.medicineCode,
                hsnCode: hsnCode ?? null,
                description: description ?? null,
                purchasePrice: purchasePrice !== undefined ? parseFloat(purchasePrice) : undefined,
                sellingPrice: sellingPrice !== undefined ? parseFloat(sellingPrice) : undefined,
                gst: gst !== undefined ? parseFloat(gst) : undefined,
                mrp: mrp !== undefined ? parseFloat(mrp) : undefined,
                openingStock: openingStock !== undefined ? parseInt(openingStock) : undefined,
                minimumStockAlert: minimumStockAlert !== undefined ? parseInt(minimumStockAlert) : undefined,
                unit: unit ?? null,
                batchNumber: batchNumber ?? null,
                manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                prescriptionRequired: prescriptionRequired !== undefined
                    ? prescriptionRequired === true || prescriptionRequired === "true"
                    : undefined,
                status,
            },
            include: { category: { select: { id: true, name: true } } },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateMedicine = updateMedicine;
// DELETE /api/medicines/:id
const deleteMedicine = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.medicine.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Medicine not found" });
        await prisma_1.default.medicine.delete({ where: { id } });
        res.json({ message: "Medicine deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteMedicine = deleteMedicine;
// POST /api/medicines/bulk-delete
const bulkDeleteMedicines = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "ids array is required" });
        }
        await prisma_1.default.medicine.deleteMany({ where: { id: { in: ids }, clinicId } });
        res.json({ message: `${ids.length} medicines deleted successfully` });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.bulkDeleteMedicines = bulkDeleteMedicines;
// POST /api/medicines/:id/add-stock
const addMedicineStock = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { quantity } = req.body;
        const parsedQuantity = parseInt(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json({ message: "Invalid quantity" });
        }
        const existing = await prisma_1.default.medicine.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Medicine not found" });
        const updated = await prisma_1.default.medicine.update({
            where: { id },
            data: {
                stockIn: { increment: parsedQuantity }
            }
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.addMedicineStock = addMedicineStock;
