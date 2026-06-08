import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getAppointments,
  getAppointmentsCalendar,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  checkFollowupStatus,
  createFollowUpAppointment,
  updateFollowUpPayment,
} from "../controllers/appointment.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/check-followup", checkFollowupStatus);
router.get("/calendar", getAppointmentsCalendar);
router.get("/", getAppointments);
router.get("/:id", getAppointmentById);
router.post("/", createAppointment);
router.post("/:id/follow-up", createFollowUpAppointment);
router.put("/:id/follow-up-payment", updateFollowUpPayment);
router.put("/:id", updateAppointment);
router.delete("/:id", deleteAppointment);

export default router;

