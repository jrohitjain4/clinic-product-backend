"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuperAdminNotification = exports.createNotificationInternal = exports.deleteNotification = exports.markAllRead = exports.markRead = exports.getNotifications = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// ─── Super-Admin notification helper ─────────────────────────────────────────
// Super admin has no clinicId, so notifications are stored without a clinicId.
// We use a special "SUPER_ADMIN" table-level marker.
// ─── GET notifications ────────────────────────────────────────────────────────
const getNotifications = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { role, clinicId, id: userId } = req.user;
        let where;
        if (role === "SUPER_ADMIN") {
            // Super admin sees all global notifications (clinicId = null)
            where = { clinicId: null };
        }
        else if (!clinicId) {
            return res.json({ notifications: [], unreadCount: 0 });
        }
        else if (role === "DOCTOR") {
            where = {
                clinicId,
                OR: [{ targetRole: "DOCTOR" }, { targetRole: "ALL" }, { targetUserId: userId }],
            };
        }
        else if (role === "PATIENT") {
            where = {
                clinicId,
                OR: [{ targetRole: "PATIENT" }, { targetRole: "ALL" }, { targetUserId: userId }],
            };
        }
        else {
            // ADMIN / STAFF
            where = {
                clinicId,
                OR: [{ targetRole: "ADMIN" }, { targetRole: "ALL" }, { targetUserId: userId }],
            };
        }
        const notifications = await prisma_1.default.notification.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 60,
        });
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        return res.json({ notifications, unreadCount });
    }
    catch (error) {
        console.error("getNotifications error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getNotifications = getNotifications;
// ─── Mark single notification as read ────────────────────────────────────────
const markRead = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { id } = req.params;
        await prisma_1.default.notification.update({ where: { id }, data: { isRead: true } });
        return res.json({ message: "Marked as read" });
    }
    catch (error) {
        console.error("markRead error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.markRead = markRead;
// ─── Mark ALL as read ─────────────────────────────────────────────────────────
const markAllRead = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { role, clinicId } = req.user;
        const where = role === "SUPER_ADMIN" ? { clinicId: null } : { clinicId };
        await prisma_1.default.notification.updateMany({ where: { ...where, isRead: false }, data: { isRead: true } });
        return res.json({ message: "All notifications marked as read" });
    }
    catch (error) {
        console.error("markAllRead error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.markAllRead = markAllRead;
// ─── Delete a notification ────────────────────────────────────────────────────
const deleteNotification = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { id } = req.params;
        await prisma_1.default.notification.delete({ where: { id } });
        return res.json({ message: "Notification deleted" });
    }
    catch (error) {
        console.error("deleteNotification error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteNotification = deleteNotification;
// ─── Internal: create a clinic-scoped notification ────────────────────────────
const createNotificationInternal = async (data) => {
    try {
        await prisma_1.default.notification.create({
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
    }
    catch (err) {
        console.error("createNotificationInternal error:", err);
    }
};
exports.createNotificationInternal = createNotificationInternal;
// ─── Internal: create a SUPER_ADMIN global notification (no clinicId) ────────
const createSuperAdminNotification = async (data) => {
    try {
        await prisma_1.default.notification.create({
            data: {
                type: data.type,
                title: data.title,
                message: data.message,
                targetRole: "SUPER_ADMIN",
                link: data.link ?? null,
                isRead: false,
            },
        });
    }
    catch (err) {
        console.error("createSuperAdminNotification error:", err);
    }
};
exports.createSuperAdminNotification = createSuperAdminNotification;
