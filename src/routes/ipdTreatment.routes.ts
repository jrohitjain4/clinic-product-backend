import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getIPDTreatments,
  getIPDTreatmentById,
  createIPDTreatment,
  updateIPDTreatment,
  deleteIPDTreatment,
} from "../controllers/ipdTreatment.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getIPDTreatments);
router.get("/:id", getIPDTreatmentById);
router.post("/", createIPDTreatment);
router.put("/:id", updateIPDTreatment);
router.delete("/:id", deleteIPDTreatment);

export default router;
