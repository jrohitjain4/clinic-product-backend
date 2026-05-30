import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";


// GET /api/specializations
export const getSpecializations = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const specializations = await prisma.specialization.findMany({
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
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/specializations
export const createSpecialization = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { name, description, image, status } = req.body;
        if (!name) return res.status(400).json({ message: "Specialization name is required" });

        const spec = await prisma.specialization.create({
            data: {
                name,
                description,
                image,
                status: status || "Active",
                clinicId
            },
        });

        res.status(201).json(spec);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/specializations/:id
export const updateSpecialization = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { name, description, image, status } = req.body;

        const existing = await prisma.specialization.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Specialization not found" });

        const updated = await prisma.specialization.update({
            where: { id },
            data: { name, description, image, status },
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/specializations/:id
export const deleteSpecialization = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.specialization.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Specialization not found" });

        const linkedDoctors = await prisma.doctor.count({ where: { specializationId: id } });
        if (linkedDoctors > 0) {
            return res.status(400).json({ message: `Cannot delete: ${linkedDoctors} doctor(s) are linked to this specialization` });
        }

        await prisma.specialization.delete({ where: { id } });
        res.json({ message: "Specialization deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
