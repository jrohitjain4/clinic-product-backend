import { Router } from "express";
import { getTenants, updateTenantStatus } from "../controllers/tenant.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticateJWT, getTenants);
router.put("/:id/status", authenticateJWT, updateTenantStatus);

export default router;
