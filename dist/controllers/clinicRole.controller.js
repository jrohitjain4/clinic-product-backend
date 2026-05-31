"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteClinicRole = exports.updateClinicRole = exports.createClinicRole = exports.getClinicRoleById = exports.getClinicRoles = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/clinic-roles
const getClinicRoles = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const roles = await prisma_1.default.clinicRole.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });
        res.json(roles);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.getClinicRoles = getClinicRoles;
// GET /api/clinic-roles/:id
const getClinicRoleById = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const role = await prisma_1.default.clinicRole.findFirst({
            where: { id, clinicId: clinicId },
        });
        if (!role)
            return res.status(404).json({ message: "Role not found" });
        res.json(role);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.getClinicRoleById = getClinicRoleById;
// POST /api/clinic-roles
const createClinicRole = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { name, permissions, status } = req.body;
        if (!name?.trim()) {
            return res.status(400).json({ message: "Role name is required" });
        }
        const newRole = await prisma_1.default.clinicRole.create({
            data: {
                name: name.trim(),
                permissions: permissions || {},
                status: status || "Active",
                clinicId,
            },
        });
        res.status(201).json(newRole);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.createClinicRole = createClinicRole;
// PUT /api/clinic-roles/:id
const updateClinicRole = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.clinicRole.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Role not found" });
        const { name, permissions, status } = req.body;
        const updated = await prisma_1.default.clinicRole.update({
            where: { id },
            data: {
                name: name !== undefined ? name.trim() : existing.name,
                permissions: permissions !== undefined ? permissions : existing.permissions,
                status: status ?? existing.status,
            },
        });
        res.json(updated);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.updateClinicRole = updateClinicRole;
// DELETE /api/clinic-roles/:id
const deleteClinicRole = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.clinicRole.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Role not found" });
        await prisma_1.default.clinicRole.delete({ where: { id } });
        res.json({ message: "Role deleted successfully" });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.deleteClinicRole = deleteClinicRole;
