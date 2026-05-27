"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTenantStatus = exports.getTenants = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getTenants = async (req, res) => {
    try {
        const tenants = await prisma.clinic.findMany({
            include: {
                package: true,
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
            let status = tenant.status;
            // Auto-infer "Trial Complete but not Upgrade"
            if (status === 'TRIAL' && tenant.packageExpiresAt) {
                if (new Date(tenant.packageExpiresAt) < new Date()) {
                    status = 'TRIAL_COMPLETED_NOT_UPGRADED';
                }
            }
            return {
                id: tenant.id,
                name: tenant.name,
                subdomain: tenant.subdomain,
                ownerName: admin?.fullName || "N/A",
                ownerEmail: admin?.email || "N/A",
                packageName: tenant.package?.name || "No Plan",
                status: status,
                expiresAt: tenant.packageExpiresAt,
                createdAt: tenant.createdAt
            };
        });
        return res.json(enrichedTenants);
    }
    catch (error) {
        console.error("Get tenants error:", error);
        return res.status(500).json({ message: "Error fetching tenants" });
    }
};
exports.getTenants = getTenants;
const updateTenantStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const updated = await prisma.clinic.update({
            where: { id },
            data: { status }
        });
        return res.json(updated);
    }
    catch (error) {
        return res.status(500).json({ message: "Error updating tenant status" });
    }
};
exports.updateTenantStatus = updateTenantStatus;
