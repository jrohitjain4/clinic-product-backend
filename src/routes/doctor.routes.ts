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
} from "../controllers/doctor.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getDoctors);
router.get("/:id", getDoctorById);
router.get("/:id/availability", getDoctorAvailability);
router.post("/", validate(doctorValidation.create), createDoctor);
router.put("/:id", updateDoctor);
router.delete("/:id", deleteDoctor);

export default router;
