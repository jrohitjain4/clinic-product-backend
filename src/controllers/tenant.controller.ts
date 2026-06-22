import { Request, Response } from "express";
import prisma from "../lib/prisma";


export const getTenants = async (req: Request, res: Response) => {
    try {
        const tenants = await prisma.clinic.findMany({
            include: {
                package: true,
                _count: {
                    select: { 
                        doctors: true,
                        staffs: true,
                        patients: true
                    }
                },
                users: {
                    where: {
                        role: 'ADMIN'
                    },
                    select: {
                        fullName: true,
                        email: true,
                        role: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Enrich with additional metrics and handle real-time status inference
        const enrichedTenants = tenants.map(tenant => {
            const admin = tenant.users[0];
            let status = tenant.status as string;

            // Auto-infer "Trial Complete but not Upgrade"
            if (status === 'TRIAL' && tenant.packageExpiresAt) {
                if (new Date(tenant.packageExpiresAt) < new Date()) {
                    status = 'TRIAL_COMPLETED_NOT_UPGRADED';
                }
            }

            const address = [tenant.addressLine1, tenant.addressLine2, tenant.city, tenant.state].filter(Boolean).join(", ") || "N/A";

            return {
                id: tenant.id,
                name: tenant.name,
                username: tenant.username || "N/A",
                ownerName: tenant.ownerName || admin?.fullName || "N/A",
                ownerEmail: tenant.ownerEmail || admin?.email || "N/A",
                packageName: tenant.package?.name || "No Plan",
                status: status,
                expiresAt: tenant.packageExpiresAt,
                createdAt: tenant.createdAt,
                phone: tenant.phone || "N/A",
                whatsappNumber: tenant.whatsappNumber || "N/A",
                addressLine1: tenant.addressLine1 || "N/A",
                addressLine2: tenant.addressLine2 || "N/A",
                district: tenant.district || "N/A",
                city: tenant.city || "N/A",
                state: tenant.state || "N/A",
                country: tenant.country || "N/A",
                pincode: tenant.pincode || "N/A",
                doctorCount: tenant.doctorCount || null,
                doctorsCount: tenant._count?.doctors || 0,
                staffsCount: tenant._count?.staffs || 0,
                patientsCount: tenant._count?.patients || 0,
                address: address
            };
        });

        return res.json(enrichedTenants);
    } catch (error) {
        console.error("Get tenants error:", error);
        return res.status(500).json({ message: "Error fetching tenants" });
    }
};

export const updateTenantStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, packageId } = req.body;

        const updateData: any = {};
        if (status !== undefined) {
            updateData.status = status;
        }

        if (packageId !== undefined) {
            updateData.packageId = packageId || null;
            if (packageId) {
                const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
                if (pkg) {
                    updateData.packageStartsAt = new Date();
                    updateData.packageExpiresAt = new Date(Date.now() + pkg.durationInDays * 24 * 60 * 60 * 1000);
                }
            } else {
                updateData.packageStartsAt = null;
                updateData.packageExpiresAt = null;
            }
        }

        const updated = await prisma.clinic.update({
            where: { id },
            data: updateData,
            include: { package: true }
        });

        return res.json(updated);
    } catch (error) {
        console.error("Update tenant status error:", error);
        return res.status(500).json({ message: "Error updating tenant status" });
    }
};
