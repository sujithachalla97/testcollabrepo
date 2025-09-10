// routes/auth.js
import express from "express";
import { register, login, me, updateMe } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";

const router = express.Router();

// Public: self-register (optional — keep or remove if you want admin-only user creation)
router.post("/register", register);

// Admin-only: create user on behalf (useful for admin creating managers/staff)
router.post("/register/admin", protect, authorizeRoles("admin"), register);

// Login
router.post("/login", login);

// Get current authenticated user's full profile (protected)
router.get("/me", protect, me);

// Update current authenticated user's own profile (protected)
router.patch("/me", protect, updateMe);

// Example admin-only test route retained
router.get("/admin", protect, authorizeRoles("admin"), (req, res) => {
  res.json({ msg: "Admin only data" });
});

export default router;
