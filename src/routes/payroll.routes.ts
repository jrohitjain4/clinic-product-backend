import { Router } from "express";
import { getPayrolls, createPayroll, updatePayroll, deletePayroll } from "../controllers/payroll.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getPayrolls);
router.post("/", createPayroll);
router.put("/:id", updatePayroll);
router.delete("/:id", deletePayroll);

export default router;
