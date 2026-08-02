import { Router } from "express";
import { getSetting, upsertSetting } from "../controllers/setting.controller";
import {
  getWorkingDaysConfig,
  updateWorkingDaysConfig,
  getIPDAdmissionFee,
  updateIPDAdmissionFee,
} from "../controllers/settings.controller";
import { authenticateJWT as authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/:key", getSetting);
router.post("/", upsertSetting);

router.get("/working-days/config", authenticate, getWorkingDaysConfig);
router.put("/working-days/config", authenticate, updateWorkingDaysConfig);

router.get("/ipd/admission-fee", authenticate, getIPDAdmissionFee);
router.put("/ipd/admission-fee", authenticate, updateIPDAdmissionFee);

export default router;
