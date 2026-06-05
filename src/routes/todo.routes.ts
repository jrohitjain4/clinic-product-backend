import { Router } from "express";
import { getTodos, createTodo, updateTodo, deleteTodo } from "../controllers/todo.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticateJWT, getTodos);
router.post("/", authenticateJWT, createTodo);
router.put("/:id", authenticateJWT, updateTodo);
router.delete("/:id", authenticateJWT, deleteTodo);

export default router;
