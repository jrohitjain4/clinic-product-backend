import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
    getDesignations,
    createDesignation,
    updateDesignation,
    deleteDesignation,
} from "../controllers/designation.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getDesignations);
router.post("/", createDesignation);
router.put("/:id", updateDesignation);
router.delete("/:id", deleteDesignation);

export default router;
