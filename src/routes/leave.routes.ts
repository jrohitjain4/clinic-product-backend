import express, { Response, NextFunction } from "express";
import { authenticateJWT, AuthenticatedRequest } from "../middlewares/auth.middleware";
import { applyLeave, getLeaves, updateLeaveStatus, deleteLeave, withdrawLeave, calculateLeaveDays } from "../controllers/leave.controller";

const router = express.Router();
router.use(authenticateJWT);

router.get("/", getLeaves);
router.get("/calculate-days", calculateLeaveDays);
router.post("/apply", applyLeave);
router.put("/:id/status", updateLeaveStatus);
router.post("/:id/withdraw", withdrawLeave);
router.delete("/:id", deleteLeave);

export default router;
