import express from "express";
import { register, login } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";

const router = express.Router();

// Public
router.post("/register", register);
router.post("/login", login);

// Protected example (only staff and above)
router.get("/me", protect, (req, res) => {
  res.json({ msg: "Profile data", user: req.user });
});

// Protected example (only admin can access)
router.get("/admin", protect, authorizeRoles("admin"), (req, res) => {
  res.json({ msg: "Admin only data" });
});

export default router;
