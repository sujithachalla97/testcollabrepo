// routes/managers.js
import express from "express";
import {
  listManagers,
  createManager,
  getManager,
  updateManager,
  disableManager,
  enableManager,
  deleteManager,
} from "../controllers/managerController.js";
import { protect } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";

const router = express.Router();

// require auth for all manager routes
router.use(protect);

// read/list allowed for admin and manager
router.get("/", authorizeRoles("admin"), listManagers);

// create only for admin
router.post("/", authorizeRoles("admin"), createManager);

// get single allowed for admin and manager
router.get("/:id", authorizeRoles("admin"), getManager);

// update, disable/enable, delete only for admin
router.patch("/:id", authorizeRoles("admin"), updateManager);
router.patch("/:id/disable", authorizeRoles("admin"), disableManager);
router.patch("/:id/enable", authorizeRoles("admin"), enableManager);
router.delete("/:id", authorizeRoles("admin"), deleteManager);

export default router;
