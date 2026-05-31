"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDepartment = exports.updateDepartment = exports.createDepartment = exports.getDepartments = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/departments
const getDepartments = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const departments = await prisma_1.default.department.findMany({
            where: { clinicId },
            include: {
                _count: { select: { designations: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        const result = departments.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            status: d.status,
            noOfDesignations: d._count.designations,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        }));
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getDepartments = getDepartments;
// POST /api/departments
const createDepartment = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { name, description } = req.body;
        if (!name)
            return res.status(400).json({ message: "Department name is required" });
        const dept = await prisma_1.default.department.create({
            data: { name, description, clinicId, status: "Active" },
        });
        res.status(201).json(dept);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createDepartment = createDepartment;
// PUT /api/departments/:id
const updateDepartment = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { name, description, status } = req.body;
        const existing = await prisma_1.default.department.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Department not found" });
        const updated = await prisma_1.default.department.update({
            where: { id },
            data: { name, description, status },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateDepartment = updateDepartment;
// DELETE /api/departments/:id
const deleteDepartment = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.department.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Department not found" });
        const linkedDesignations = await prisma_1.default.designation.count({ where: { departmentId: id } });
        if (linkedDesignations > 0) {
            return res.status(400).json({ message: `Cannot delete: ${linkedDesignations} designation(s) are linked to this department` });
        }
        await prisma_1.default.department.delete({ where: { id } });
        res.json({ message: "Department deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteDepartment = deleteDepartment;
