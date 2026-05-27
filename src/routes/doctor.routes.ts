import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
    getDoctors,
    getDoctorById,
    createDoctor,
    updateDoctor,
    deleteDoctor,
} from "../controllers/doctor.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getDoctors);
router.get("/:id", getDoctorById);
router.post("/", createDoctor);
router.put("/:id", updateDoctor);
router.delete("/:id", deleteDoctor);

export default router;
