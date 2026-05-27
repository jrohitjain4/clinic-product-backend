import express from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
    getAttendance,
    markAttendance,
    markSelfAttendance,
    getMyTodayStatus
} from "../controllers/attendance.controller";

const router = express.Router();

router.use(authenticateJWT);

router.post("/mark-self", markSelfAttendance);
router.post("/mark", markAttendance);
router.get("/today-status", getMyTodayStatus);
router.get("/", getAttendance);

export default router;
