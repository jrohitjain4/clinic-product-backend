import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getIPDChargeTypes,
  createIPDChargeType,
  updateIPDChargeType,
  deleteIPDChargeType,
  createIPDChargeItemMaster,
  deleteIPDChargeItemMaster,
} from "../controllers/ipdChargeType.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getIPDChargeTypes);
router.post("/", createIPDChargeType);
router.put("/:id", updateIPDChargeType);
router.delete("/:id", deleteIPDChargeType);

router.post("/:id/items", createIPDChargeItemMaster);
router.delete("/items/:itemId", deleteIPDChargeItemMaster);

export default router;
