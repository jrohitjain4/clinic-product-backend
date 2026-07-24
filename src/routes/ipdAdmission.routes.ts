import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getIPDAdmissions,
  getIPDAdmissionById,
  createIPDAdmission,
  updateIPDAdmission,
  deleteIPDAdmission,
  dischargeIPDAdmission,
} from "../controllers/ipdAdmission.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getIPDAdmissions);
router.get("/:id", getIPDAdmissionById);
router.post("/", createIPDAdmission);
router.put("/:id", updateIPDAdmission);
router.put("/:id/discharge", dischargeIPDAdmission);
router.delete("/:id", deleteIPDAdmission);

export default router;
