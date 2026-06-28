import { Router } from "express";
import { getLabTests, createLabTest, updateLabTest, deleteLabTest, bulkDeleteLabTests } from "../controllers/labTest.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getLabTests);
router.post("/", createLabTest);
router.post("/bulk-delete", bulkDeleteLabTests);
router.put("/:id", updateLabTest);
router.delete("/:id", deleteLabTest);

export default router;
