import { Router } from "express";
import { getNotes, createNote, updateNote, deleteNote, bulkDeleteNotes } from "../controllers/note.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticateJWT, getNotes);
router.post("/", authenticateJWT, createNote);
router.post("/bulk-delete", authenticateJWT, bulkDeleteNotes);
router.put("/:id", authenticateJWT, updateNote);
router.delete("/:id", authenticateJWT, deleteNote);

export default router;
