import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/medicines
export const getMedicines = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const medicines = await prisma.medicine.findMany({
            where: { clinicId },
            include: { category: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
        });

        res.json(medicines);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/medicines/:id
export const getMedicineById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const medicine = await prisma.medicine.findFirst({
            where: { id, clinicId: clinicId! },
            include: { category: { select: { id: true, name: true } } },
        });
        if (!medicine) return res.status(404).json({ message: "Medicine not found" });

        res.json(medicine);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/medicines
export const createMedicine = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const {
            medicineName, genericName, brandName, categoryId, manufacturer,
            medicineCode, hsnCode, description,
            purchasePrice, sellingPrice, gst, mrp,
            openingStock, minimumStockAlert, unit,
            batchNumber, manufacturingDate, expiryDate,
            prescriptionRequired, status,
        } = req.body;

        if (!medicineName) return res.status(400).json({ message: "Medicine name is required" });

        const autoCode = medicineCode || `MED-${Math.floor(100000 + Math.random() * 900000)}`;

        const parsedOpeningStock = parseInt(openingStock) || 0;

        const medicine = await prisma.medicine.create({
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
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/medicines/:id
export const updateMedicine = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.medicine.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Medicine not found" });

        const {
            medicineName, genericName, brandName, categoryId, manufacturer,
            medicineCode, hsnCode, description,
            purchasePrice, sellingPrice, gst, mrp,
            openingStock, minimumStockAlert, unit,
            batchNumber, manufacturingDate, expiryDate,
            prescriptionRequired, status,
        } = req.body;

        const updated = await prisma.medicine.update({
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
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/medicines/:id
export const deleteMedicine = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.medicine.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Medicine not found" });

        await prisma.medicine.delete({ where: { id } });
        res.json({ message: "Medicine deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/medicines/bulk-delete
export const bulkDeleteMedicines = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "ids array is required" });
        }

        await prisma.medicine.deleteMany({ where: { id: { in: ids }, clinicId } });
        res.json({ message: `${ids.length} medicines deleted successfully` });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/medicines/:id/add-stock
export const addMedicineStock = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { quantity } = req.body;

        const parsedQuantity = parseInt(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json({ message: "Invalid quantity" });
        }

        const existing = await prisma.medicine.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Medicine not found" });

        const updated = await prisma.medicine.update({
            where: { id },
            data: {
                stockIn: { increment: parsedQuantity }
            }
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

