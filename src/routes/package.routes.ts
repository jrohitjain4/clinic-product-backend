import { Router } from "express";
import { getPackages, createPackage, updatePackage, deletePackage } from "../controllers/package.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

// Publicly accessible for registration
router.get("/", getPackages);

// Super Admin protected (Should add role check here, but using authenticateJWT for now)
router.post("/", authenticateJWT, createPackage);
router.put("/:id", authenticateJWT, updatePackage);
router.delete("/:id", authenticateJWT, deletePackage);

export default router;
