import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
    getSpecializations,
    createSpecialization,
    updateSpecialization,
    deleteSpecialization,
} from "../controllers/specialization.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getSpecializations);
router.post("/", createSpecialization);
router.put("/:id", updateSpecialization);
router.delete("/:id", deleteSpecialization);

export default router;
