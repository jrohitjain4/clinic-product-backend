import { Router } from "express";
import {
    getPrescriptions,
    createPrescription,
    getPrescriptionById,
    updatePrescription,
    deletePrescription
} from "../controllers/prescription.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getPrescriptions);
router.post("/", createPrescription);
router.get("/:id", getPrescriptionById);
router.put("/:id", updatePrescription);
router.delete("/:id", deletePrescription);

export default router;
