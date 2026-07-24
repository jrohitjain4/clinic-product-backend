import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getIPDWards,
  getIPDWardById,
  createIPDWard,
  updateIPDWard,
  deleteIPDWard,
} from "../controllers/ipdWard.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getIPDWards);
router.get("/:id", getIPDWardById);
router.post("/", createIPDWard);
router.put("/:id", updateIPDWard);
router.delete("/:id", deleteIPDWard);

export default router;
