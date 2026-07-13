import { Router } from "express";
import {
    getMedicines, getMedicineById, createMedicine,
    updateMedicine, deleteMedicine, bulkDeleteMedicines,
    addMedicineStock, bulkCreateMedicines
} from "../controllers/medicine.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getMedicines);
router.get("/:id", getMedicineById);
router.post("/", createMedicine);
router.post("/bulk-delete", bulkDeleteMedicines);
router.post("/bulk-create", bulkCreateMedicines);
router.post("/:id/add-stock", addMedicineStock);
router.put("/:id", updateMedicine);
router.delete("/:id", deleteMedicine);

export default router;
