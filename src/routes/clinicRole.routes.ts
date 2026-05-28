import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
    getClinicRoles,
    getClinicRoleById,
    createClinicRole,
    updateClinicRole,
    deleteClinicRole,
} from "../controllers/clinicRole.controller";

const router = Router();

router.use(authenticateJWT); // Protect all roles routes

router.get("/", getClinicRoles);
router.get("/:id", getClinicRoleById);
router.post("/", createClinicRole);
router.put("/:id", updateClinicRole);
router.delete("/:id", deleteClinicRole);

export default router;
