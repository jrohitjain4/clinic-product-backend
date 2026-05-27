import { Router } from "express";
import { getExpenses, createExpense, updateExpense, deleteExpense } from "../controllers/expense.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getExpenses);
router.post("/", createExpense);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

export default router;
