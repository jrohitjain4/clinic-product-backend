import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { getServices, createService, updateService, deleteService } from "../controllers/service.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getServices);
router.post("/", createService);
router.put("/:id", updateService);
router.delete("/:id", deleteService);

export default router;
