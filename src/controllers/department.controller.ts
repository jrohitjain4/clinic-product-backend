import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/departments
export const getDepartments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const departments = await prisma.department.findMany({
            where: { clinicId },
            include: {
                _count: { select: { designations: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const result = departments.map((d) => ({
            id: d.id,
            departmentCode: d.departmentCode,
            name: d.name,
            description: d.description,
            iconUrl: d.iconUrl,
            status: d.status,
            noOfDesignations: d._count.designations,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        }));

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/departments
export const createDepartment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { name, description, iconUrl } = req.body;
        if (!name) return res.status(400).json({ message: "Department name is required" });

        const count = await prisma.department.count({ where: { clinicId } });
        const departmentCode = `DPT-${String(count + 1).padStart(2, "0")}`;

        const dept = await prisma.department.create({
            data: { departmentCode, name, description, iconUrl, clinicId, status: "Active" },
        });

        res.status(201).json(dept);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/departments/:id
export const updateDepartment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { name, description, iconUrl, status } = req.body;

        const existing = await prisma.department.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Department not found" });

        const updated = await prisma.department.update({
            where: { id },
            data: { name, description, iconUrl, status },
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/departments/:id
export const deleteDepartment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.department.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Department not found" });

        await prisma.$transaction(async (tx) => {
            // Nullify optional FK references
            await tx.designation.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
            await tx.doctor.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
            await tx.staff.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
            await tx.appointment.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
            await tx.prescription.updateMany({ where: { departmentId: id }, data: { departmentId: null } });

            // Service.departmentId is required (non-nullable), so delete services and their invoice items
            const services = await tx.service.findMany({ where: { departmentId: id }, select: { id: true } });
            const serviceIds = services.map(s => s.id);
            if (serviceIds.length > 0) {
                await tx.invoiceItem.deleteMany({ where: { serviceId: { in: serviceIds } } });
                await tx.service.deleteMany({ where: { id: { in: serviceIds } } });
            }

            await tx.department.delete({ where: { id } });
        });

        res.json({ message: "Department deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/departments/bulk-delete
export const bulkDeleteDepartments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ message: "Invalid IDs provided" });
        }

        const departmentsToDelete = await prisma.department.findMany({
            where: { id: { in: ids }, clinicId: clinicId! }
        });

        if (departmentsToDelete.length === 0) {
            return res.status(404).json({ message: "No matching departments found" });
        }

        const validIds = departmentsToDelete.map(d => d.id);

        await prisma.$transaction(async (tx) => {
            // Nullify optional FK references
            await tx.designation.updateMany({ where: { departmentId: { in: validIds } }, data: { departmentId: null } });
            await tx.doctor.updateMany({ where: { departmentId: { in: validIds } }, data: { departmentId: null } });
            await tx.staff.updateMany({ where: { departmentId: { in: validIds } }, data: { departmentId: null } });
            await tx.appointment.updateMany({ where: { departmentId: { in: validIds } }, data: { departmentId: null } });
            await tx.prescription.updateMany({ where: { departmentId: { in: validIds } }, data: { departmentId: null } });

            // Service.departmentId is required, so delete services and their invoice items
            const services = await tx.service.findMany({ where: { departmentId: { in: validIds } }, select: { id: true } });
            const serviceIds = services.map(s => s.id);
            if (serviceIds.length > 0) {
                await tx.invoiceItem.deleteMany({ where: { serviceId: { in: serviceIds } } });
                await tx.service.deleteMany({ where: { id: { in: serviceIds } } });
            }

            await tx.department.deleteMany({ where: { id: { in: validIds } } });
        });

        res.json({ message: `${validIds.length} department(s) deleted successfully` });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
