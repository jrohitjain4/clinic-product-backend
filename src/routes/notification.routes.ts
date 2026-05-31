import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
    getNotifications,
    markRead,
    markAllRead,
    deleteNotification,
} from "../controllers/notification.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getNotifications);
router.patch("/:id/read", markRead);
router.patch("/mark-all-read", markAllRead);
router.delete("/:id", deleteNotification);

export default router;
