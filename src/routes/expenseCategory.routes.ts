import { Router } from "express";
import { getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory } from "../controllers/expenseCategory.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getExpenseCategories);
router.post("/", createExpenseCategory);
router.put("/:id", updateExpenseCategory);
router.delete("/:id", deleteExpenseCategory);

export default router;
