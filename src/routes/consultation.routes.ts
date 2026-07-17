import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  createConsultation,
  getConsultations,
  getConsultationById,
  updateConsultation,
  updateConsultationPayment,
  deleteConsultation,
  getDoctorTherapy,
} from "../controllers/consultation.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/doctor-therapy", getDoctorTherapy);
router.post("/", createConsultation);
router.get("/", getConsultations);
router.get("/:id", getConsultationById);
router.put("/:id", updateConsultation);
router.put("/:id/payment", updateConsultationPayment);
router.delete("/:id", deleteConsultation);

export default router;
