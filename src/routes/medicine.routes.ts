import { Router } from "express";
import {
    getMedicines, getMedicineById, createMedicine,
    updateMedicine, deleteMedicine, bulkDeleteMedicines
} from "../controllers/medicine.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getMedicines);
router.get("/:id", getMedicineById);
router.post("/", createMedicine);
router.post("/bulk-delete", bulkDeleteMedicines);
router.put("/:id", updateMedicine);
router.delete("/:id", deleteMedicine);

export default router;
