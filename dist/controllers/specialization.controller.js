"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSpecialization = exports.updateSpecialization = exports.createSpecialization = exports.getSpecializations = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/specializations
const getSpecializations = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const specializations = await prisma_1.default.specialization.findMany({
            where: { clinicId },
            include: {
                _count: { select: { doctors: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        const result = specializations.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            image: s.image,
            status: s.status,
            noOfDoctor: s._count.doctors,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
        }));
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getSpecializations = getSpecializations;
// POST /api/specializations
const createSpecialization = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { name, description, image, status } = req.body;
        if (!name)
            return res.status(400).json({ message: "Specialization name is required" });
        const spec = await prisma_1.default.specialization.create({
            data: {
                name,
                description,
                image,
                status: status || "Active",
                clinicId
            },
        });
        res.status(201).json(spec);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createSpecialization = createSpecialization;
// PUT /api/specializations/:id
const updateSpecialization = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { name, description, image, status } = req.body;
        const existing = await prisma_1.default.specialization.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Specialization not found" });
        const updated = await prisma_1.default.specialization.update({
            where: { id },
            data: { name, description, image, status },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateSpecialization = updateSpecialization;
// DELETE /api/specializations/:id
const deleteSpecialization = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.specialization.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Specialization not found" });
        const linkedDoctors = await prisma_1.default.doctor.count({ where: { specializationId: id } });
        if (linkedDoctors > 0) {
            return res.status(400).json({ message: `Cannot delete: ${linkedDoctors} doctor(s) are linked to this specialization` });
        }
        await prisma_1.default.specialization.delete({ where: { id } });
        res.json({ message: "Specialization deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteSpecialization = deleteSpecialization;
