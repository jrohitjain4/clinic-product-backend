import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getIPDPrescriptions,
  createIPDPrescription,
  updateIPDPrescription,
  deleteIPDPrescription,
} from "../controllers/ipdPrescription.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getIPDPrescriptions);
router.post("/", createIPDPrescription);
router.put("/:id", updateIPDPrescription);
router.delete("/:id", deleteIPDPrescription);

export default router;
