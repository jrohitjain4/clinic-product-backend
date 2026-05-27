import { Router } from "express";
import { getHolidays, createHoliday, updateHoliday, deleteHoliday } from "../controllers/holiday.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getHolidays);
router.post("/", createHoliday);
router.put("/:id", updateHoliday);
router.delete("/:id", deleteHoliday);

export default router;
