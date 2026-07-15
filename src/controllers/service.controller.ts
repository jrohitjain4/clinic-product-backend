import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";


// GET /api/services
export const getServices = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { type } = req.query;
        const whereClause: any = { clinicId };
        if (type) {
            whereClause.serviceType = type as string;
        }

        const services = await prisma.service.findMany({
            where: whereClause,
            include: {
                department: { select: { id: true, name: true } },
                specialization: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json(services);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/services
export const createService = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const {
            serviceName,
            serviceCode,
            serviceType,
            description,
            gallery,
            minSessions,
            maxSessions,
            sessionGap,
            scheduleType,
            customDates,
            departmentId,
            specializationId,
            price,
            duration,
            status
        } = req.body;

        if (!serviceName) {
            return res.status(400).json({ message: "Service Name is required" });
        }

        if (serviceType === "therapy") {
            if (!specializationId) {
                return res.status(400).json({ message: "Category is required for therapy" });
            }
        } else {
            if (!departmentId) {
                return res.status(400).json({ message: "Department is required" });
            }
        }

        const newService = await prisma.service.create({
            data: {
                serviceName,
                serviceCode: serviceCode || null,
                serviceType: serviceType || "regular",
                description: description || null,
                gallery: Array.isArray(gallery) ? gallery : [],
                minSessions: minSessions !== undefined && minSessions !== null && minSessions !== "" ? parseInt(minSessions) : null,
                maxSessions: maxSessions !== undefined && maxSessions !== null && maxSessions !== "" ? parseInt(maxSessions) : null,
                sessionGap: sessionGap !== undefined && sessionGap !== null && sessionGap !== "" ? parseInt(sessionGap) : null,
                scheduleType: scheduleType || null,
                customDates: customDates || null,
                departmentId: departmentId || null,
                specializationId: specializationId || null,
                price: price !== undefined && price !== null && price !== "" ? parseFloat(price) : null,
                duration: duration || null,
                status: status || "Active",
                clinicId,
            },
            include: {
                department: true,
                specialization: true,
            }
        });

        res.status(201).json(newService);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/services/:id
export const updateService = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const {
            serviceName,
            serviceCode,
            serviceType,
            description,
            gallery,
            minSessions,
            maxSessions,
            sessionGap,
            scheduleType,
            customDates,
            departmentId,
            specializationId,
            price,
            duration,
            status
        } = req.body;

        const existing = await prisma.service.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Service not found" });

        const updated = await prisma.service.update({
            where: { id },
            data: {
                serviceName,
                serviceCode,
                serviceType,
                description,
                gallery: Array.isArray(gallery) ? gallery : undefined,
                minSessions: minSessions !== undefined ? (minSessions !== null && minSessions !== "" ? parseInt(minSessions) : null) : undefined,
                maxSessions: maxSessions !== undefined ? (maxSessions !== null && maxSessions !== "" ? parseInt(maxSessions) : null) : undefined,
                sessionGap: sessionGap !== undefined ? (sessionGap !== null && sessionGap !== "" ? parseInt(sessionGap) : null) : undefined,
                scheduleType,
                customDates,
                departmentId: departmentId !== undefined ? (departmentId || null) : undefined,
                specializationId: specializationId !== undefined ? (specializationId || null) : undefined,
                price: price !== undefined ? (price !== null && price !== "" ? parseFloat(price) : null) : undefined,
                duration: duration !== undefined ? duration : undefined,
                status,
            },
            include: {
                department: true,
                specialization: true,
            }
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/services/:id
export const deleteService = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.service.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Service not found" });

        await prisma.service.delete({ where: { id } });
        res.json({ message: "Service deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
