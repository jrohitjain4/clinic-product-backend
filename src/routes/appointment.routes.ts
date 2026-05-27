import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getAppointments,
  getAppointmentsCalendar,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from "../controllers/appointment.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/calendar", getAppointmentsCalendar);
router.get("/", getAppointments);
router.get("/:id", getAppointmentById);
router.post("/", createAppointment);
router.put("/:id", updateAppointment);
router.delete("/:id", deleteAppointment);

export default router;
