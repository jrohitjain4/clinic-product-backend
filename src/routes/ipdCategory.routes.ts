import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getIPDCategories,
  createIPDCategory,
  updateIPDCategory,
  deleteIPDCategory,
} from "../controllers/ipdCategory.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getIPDCategories);
router.post("/", createIPDCategory);
router.put("/:id", updateIPDCategory);
router.delete("/:id", deleteIPDCategory);

export default router;
