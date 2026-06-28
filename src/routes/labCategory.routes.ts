import { Router } from "express";
import { getLabCategories, createLabCategory, updateLabCategory, deleteLabCategory, bulkDeleteLabCategories } from "../controllers/labCategory.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getLabCategories);
router.post("/", createLabCategory);
router.post("/bulk-delete", bulkDeleteLabCategories);
router.put("/:id", updateLabCategory);
router.delete("/:id", deleteLabCategory);

export default router;
