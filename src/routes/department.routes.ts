import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    bulkDeleteDepartments,
} from "../controllers/department.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getDepartments);
router.post("/", createDepartment);
router.post("/bulk-delete", bulkDeleteDepartments);
router.put("/:id", updateDepartment);
router.delete("/:id", deleteDepartment);

export default router;
