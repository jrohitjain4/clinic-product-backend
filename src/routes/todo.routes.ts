import { Router } from "express";
import { getTodos, createTodo, updateTodo, deleteTodo, bulkDeleteTodos } from "../controllers/todo.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticateJWT, getTodos);
router.post("/", authenticateJWT, createTodo);
router.post("/bulk-delete", authenticateJWT, bulkDeleteTodos);
router.put("/:id", authenticateJWT, updateTodo);
router.delete("/:id", authenticateJWT, deleteTodo);

export default router;
