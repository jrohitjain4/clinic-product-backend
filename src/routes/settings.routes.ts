import { Router } from "express";
import { getSetting, upsertSetting } from "../controllers/setting.controller";
import { getWorkingDaysConfig, updateWorkingDaysConfig } from "../controllers/settings.controller";
import { authenticateJWT as authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/:key", getSetting);
router.post("/", upsertSetting);

router.get("/working-days/config", authenticate, getWorkingDaysConfig);
router.put("/working-days/config", authenticate, updateWorkingDaysConfig);

export default router;
