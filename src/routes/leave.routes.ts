import express, { Response, NextFunction } from "express";
import { authenticateJWT, AuthenticatedRequest } from "../middlewares/auth.middleware";
import { applyLeave, getLeaves, updateLeaveStatus, deleteLeave } from "../controllers/leave.controller";

const router = express.Router();
router.use(authenticateJWT);

router.get("/", getLeaves);
router.post("/apply", applyLeave);
router.put("/:id/status", updateLeaveStatus);
router.delete("/:id", deleteLeave);

export default router;
