import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
    getDesignations,
    createDesignation,
    updateDesignation,
    deleteDesignation,
    bulkDeleteDesignations,
} from "../controllers/designation.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getDesignations);
router.post("/", createDesignation);
router.post("/bulk-delete", bulkDeleteDesignations);
router.put("/:id", updateDesignation);
router.delete("/:id", deleteDesignation);

export default router;
