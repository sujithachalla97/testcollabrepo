// routes/staff.js
import express from "express";
import {
  listStaff,
  createStaff,
  getStaff,
  updateStaff,
  disableStaff,
  enableStaff,
  deleteStaff,
} from "../controllers/staffController.js";
import { protect } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";

const router = express.Router();

// require auth
router.use(protect);

// listing + create + update allowed for admin & manager
router.get("/", authorizeRoles("admin", "manager"), listStaff);
router.post("/", authorizeRoles("admin", "manager"), createStaff);
router.get("/:id", authorizeRoles("admin", "manager"), getStaff);
router.patch("/:id", authorizeRoles("admin", "manager"), updateStaff);

// destructive admin-only operations
router.patch("/:id/disable", authorizeRoles("admin"), disableStaff);
router.patch("/:id/enable", authorizeRoles("admin"), enableStaff);
router.delete("/:id", authorizeRoles("admin"), deleteStaff);

export default router;
