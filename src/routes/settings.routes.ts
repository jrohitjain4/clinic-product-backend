import { Router } from "express";
import { getSetting, upsertSetting } from "../controllers/setting.controller";

const router = Router();

router.get("/:key", getSetting);
router.post("/", upsertSetting);

export default router;
