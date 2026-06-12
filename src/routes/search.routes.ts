import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { globalSearch } from "../controllers/search.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", globalSearch);

export default router;
