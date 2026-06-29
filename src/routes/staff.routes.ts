import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getStaffs,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  resetStaffPassword,
} from "../controllers/staff.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getStaffs);
router.get("/:id", getStaffById);
router.post("/", createStaff);
router.post("/:id/reset-password", resetStaffPassword);
router.put("/:id", updateStaff);
router.delete("/:id", deleteStaff);

export default router;
