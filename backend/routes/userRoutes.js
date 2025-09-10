// backend/src/routes/user.routes.js
import express from "express";
import { updateUser, getUserById } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";

const router = express.Router();

/**
 * GET /api/users/:id
 * - Admin: can fetch any user
 * - Others: only fetch their own profile
 */
router.get("/:id", protect, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && req.user.id !== req.params.id) {
      return res.status(403).json({ msg: "Forbidden: cannot view other users" });
    }
    return getUserById(req, res, next);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/users/:id
 * - Admin: can update any user
 * - Others: only update their own profile
 */
router.put("/:id", protect, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && req.user.id !== req.params.id) {
      return res.status(403).json({ msg: "Forbidden: cannot update other users" });
    }
    return updateUser(req, res, next);
  } catch (err) {
    next(err);
  }
});

export default router;
