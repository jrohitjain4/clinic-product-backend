import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// ─── Super-Admin notification helper ─────────────────────────────────────────
// Super admin has no clinicId, so notifications are stored without a clinicId.
// We use a special "SUPER_ADMIN" table-level marker.

// ─── GET notifications ────────────────────────────────────────────────────────
export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const { role, clinicId, id: userId } = req.user as any;

        let where: any;

        if (role === "SUPER_ADMIN") {
            // Super admin sees all global notifications (clinicId = null)
            where = { clinicId: null };
        } else if (!clinicId) {
            return res.json({ notifications: [], unreadCount: 0 });
        } else if (role === "DOCTOR") {
            where = {
                clinicId,
                OR: [{ targetRole: "DOCTOR" }, { targetRole: "ALL" }, { targetUserId: userId }],
            };
        } else if (role === "PATIENT") {
            where = {
                clinicId,
                OR: [{ targetRole: "PATIENT" }, { targetRole: "ALL" }, { targetUserId: userId }],
            };
        } else {
            // ADMIN / STAFF
            where = {
                clinicId,
                OR: [{ targetRole: "ADMIN" }, { targetRole: "ALL" }, { targetUserId: userId }],
            };
        }

        const notifications = await (prisma as any).notification.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 60,
        });

        const unreadCount = notifications.filter((n: any) => !n.isRead).length;
        return res.json({ notifications, unreadCount });
    } catch (error) {
        console.error("getNotifications error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Mark single notification as read ────────────────────────────────────────
export const markRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        const { id } = req.params;
        await (prisma as any).notification.update({ where: { id }, data: { isRead: true } });
        return res.json({ message: "Marked as read" });
    } catch (error) {
        console.error("markRead error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Mark ALL as read ─────────────────────────────────────────────────────────
export const markAllRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        const { role, clinicId } = req.user as any;

        const where = role === "SUPER_ADMIN" ? { clinicId: null } : { clinicId };
        await (prisma as any).notification.updateMany({ where: { ...where, isRead: false }, data: { isRead: true } });
        return res.json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("markAllRead error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Delete a notification ────────────────────────────────────────────────────
export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        const { id } = req.params;
        await (prisma as any).notification.delete({ where: { id } });
        return res.json({ message: "Notification deleted" });
    } catch (error) {
        console.error("deleteNotification error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Internal: create a clinic-scoped notification ────────────────────────────
export const createNotificationInternal = async (data: {
    clinicId: string;
    type: string;
    title: string;
    message: string;
    targetRole?: string;
    targetUserId?: string;
    link?: string;
}) => {
    try {
        await (prisma as any).notification.create({
            data: {
                clinicId: data.clinicId,
                type: data.type,
                title: data.title,
                message: data.message,
                targetRole: data.targetRole ?? "ALL",
                targetUserId: data.targetUserId ?? null,
                link: data.link ?? null,
                isRead: false,
            },
        });
    } catch (err) {
        console.error("createNotificationInternal error:", err);
    }
};

// ─── Internal: create a SUPER_ADMIN global notification (no clinicId) ────────
export const createSuperAdminNotification = async (data: {
    type: string;
    title: string;
    message: string;
    link?: string;
}) => {
    try {
        await (prisma as any).notification.create({
            data: {
                type: data.type,
                title: data.title,
                message: data.message,
                targetRole: "SUPER_ADMIN",
                link: data.link ?? null,
                isRead: false,
            },
        });
    } catch (err) {
        console.error("createSuperAdminNotification error:", err);
    }
};
