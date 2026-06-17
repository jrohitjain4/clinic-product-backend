import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { doctorValidation } from "../validations/doctor.validation";
import {
    getDoctors,
    getDoctorById,
    getDoctorAvailability,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    getDoctorDashboardStats,
} from "../controllers/doctor.controller";

const router = Router();

router.get("/:id/availability", getDoctorAvailability);

router.use(authenticateJWT);

router.get("/my-dashboard", getDoctorDashboardStats);
router.get("/", getDoctors);
router.get("/:id", getDoctorById);
router.post("/", validate(doctorValidation.create), createDoctor);
router.put("/:id", updateDoctor);
router.delete("/:id", deleteDoctor);

export default router;
