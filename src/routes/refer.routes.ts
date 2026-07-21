import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { getRefers, createRefer, updateRefer, deleteRefer } from "../controllers/refer.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getRefers);
router.post("/", createRefer);
router.put("/:id", updateRefer);
router.delete("/:id", deleteRefer);

export default router;
