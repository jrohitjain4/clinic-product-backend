"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTenantStatus = exports.getTenants = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getTenants = async (req, res) => {
    try {
        const tenants = await prisma_1.default.clinic.findMany({
            include: {
                package: true,
                _count: {
                    select: { doctors: true }
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
            let status = tenant.status;
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
                subdomain: tenant.username,
                ownerName: admin?.fullName || "N/A",
                ownerEmail: admin?.email || "N/A",
                packageName: tenant.package?.name || "No Plan",
                status: status,
                expiresAt: tenant.packageExpiresAt,
                createdAt: tenant.createdAt,
                phone: tenant.phone || "N/A",
                address: address,
                doctorsCount: tenant._count?.doctors || 0
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
        const updated = await prisma_1.default.clinic.update({
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
