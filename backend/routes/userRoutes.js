// backend/src/routes/user.routes.js
import express from "express";
import { updateUser,getUserById } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";


const router = express.Router();

// PUT /api/users/:id → update profile
router.get("/:id", protect, getUserById);
router.put("/:id", protect, updateUser);

export default router;
