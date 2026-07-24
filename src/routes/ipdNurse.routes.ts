import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getIPDNurses,
  createIPDNurse,
  updateIPDNurse,
  deleteIPDNurse,
} from "../controllers/ipdNurse.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getIPDNurses);
router.post("/", createIPDNurse);
router.put("/:id", updateIPDNurse);
router.delete("/:id", deleteIPDNurse);

export default router;
