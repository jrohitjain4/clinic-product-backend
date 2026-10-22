import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { getPackageSequenceRank } from "./auth.controller";

export const getPackages = async (req: Request, res: Response) => {
    try {
        const packages = await prisma.subscriptionPackage.findMany({
            include: {
                _count: {
                    select: { clinics: true }
                }
            },
        });

        const sorted = [...packages].sort((a, b) => {
            const rankA = getPackageSequenceRank(a);
            const rankB = getPackageSequenceRank(b);
            if (rankA !== rankB) return rankA - rankB;
            const priceA = Number(a.price) || 0;
            const priceB = Number(b.price) || 0;
            if (priceA !== priceB) return priceA - priceB;
            return (Number(a.durationInDays) || 0) - (Number(b.durationInDays) || 0);
        });

        return res.json(sorted);
    } catch (error: any) {
        console.error("Error fetching packages:", error);
        return res.status(500).json({ message: "Error fetching packages" });
    }
};

export const createPackage = async (req: Request, res: Response) => {
    try {
        const { name, price, durationInDays, isActive, maxDoctors, maxPatients, maxAppointments } = req.body;

        if (!name || price === undefined || price === null || !durationInDays) {
            return res.status(400).json({ message: "Name, price, and duration in days are required" });
        }

        const newPackage = await prisma.subscriptionPackage.create({
            data: {
                name: name.trim(),
                price: Math.max(0, parseFloat(price)),
                durationInDays: parseInt(durationInDays),
                isActive: isActive !== undefined ? Boolean(isActive) : true,
                maxDoctors: maxDoctors !== undefined && maxDoctors !== "" && maxDoctors !== null ? parseInt(maxDoctors) : null,
                maxPatients: maxPatients !== undefined && maxPatients !== "" && maxPatients !== null ? parseInt(maxPatients) : null,
                maxAppointments: maxAppointments !== undefined && maxAppointments !== "" && maxAppointments !== null ? parseInt(maxAppointments) : null,
            },
            include: {
                _count: {
                    select: { clinics: true }
                }
            }
        });

        return res.status(201).json(newPackage);
    } catch (error: any) {
        console.error("Create package error:", error);
        return res.status(500).json({ message: error.message || "Error creating package" });
    }
};

export const updatePackage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, durationInDays, isActive, maxDoctors, maxPatients, maxAppointments } = req.body;

        const updated = await prisma.subscriptionPackage.update({
            where: { id },
            data: {
                name: name ? name.trim() : undefined,
                price: price !== undefined && price !== null && price !== "" ? Math.max(0, parseFloat(price)) : undefined,
                durationInDays: durationInDays ? parseInt(durationInDays) : undefined,
                isActive: isActive !== undefined ? Boolean(isActive) : undefined,
                maxDoctors: maxDoctors !== undefined ? (maxDoctors === "" || maxDoctors === null ? null : parseInt(maxDoctors)) : undefined,
                maxPatients: maxPatients !== undefined ? (maxPatients === "" || maxPatients === null ? null : parseInt(maxPatients)) : undefined,
                maxAppointments: maxAppointments !== undefined ? (maxAppointments === "" || maxAppointments === null ? null : parseInt(maxAppointments)) : undefined,
            },
            include: {
                _count: {
                    select: { clinics: true }
                }
            }
        });

        return res.json(updated);
    } catch (error: any) {
        console.error("Update package error:", error);
        return res.status(500).json({ message: error.message || "Error updating package" });
    }
};

export const deletePackage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Safety check for live database: check if any clinic is using this plan
        const activeClinicsCount = await prisma.clinic.count({ where: { packageId: id } });
        if (activeClinicsCount > 0) {
            return res.status(400).json({ 
                message: `Cannot delete: ${activeClinicsCount} clinic(s) are currently assigned to this package. Please disable the package instead of deleting it to protect clinic records.` 
            });
        }

        await prisma.subscriptionPackage.delete({ where: { id } });
        return res.json({ message: "Package deleted successfully" });
    } catch (error: any) {
        console.error("Delete package error:", error);
        return res.status(500).json({ message: error.message || "Error deleting package" });
    }
};
