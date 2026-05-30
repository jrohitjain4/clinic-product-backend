import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { patientValidation } from "../validations/patient.validation";
import {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
} from "../controllers/patient.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getPatients);
router.get("/:id", getPatientById);
router.post("/", validate(patientValidation.create), createPatient);
router.put("/:id", updatePatient);
router.delete("/:id", deletePatient);

export default router;
