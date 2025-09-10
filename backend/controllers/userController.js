// backend/controllers/user.controller.js
import User from "../models/User.js";
import bcrypt from "bcrypt";

/**
 * Update user
 * - Admin: can update any user and set role
 * - Others: can update only their own profile and cannot set role
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const caller = req.user; // { id, role } set by protect middleware

    // Find target user
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Authorization: allow if admin OR caller is the same user
    const isAdmin = caller?.role === "admin";
    const isSelf = String(caller?.id) === String(id);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ msg: "Forbidden: cannot update other users" });
    }

    // If non-admin attempts to change role, reject
    if (!isAdmin && Object.prototype.hasOwnProperty.call(req.body, "role")) {
      return res.status(403).json({ msg: "Forbidden: cannot change role" });
    }

    // Validate uniqueness if email/username changed
    if (req.body.email && req.body.email !== user.email) {
      const exists = await User.findOne({ email: req.body.email });
      if (exists) return res.status(400).json({ msg: "Email already in use" });
      user.email = req.body.email;
    }

    if (req.body.username && req.body.username !== user.username) {
      const existsU = await User.findOne({ username: req.body.username });
      if (existsU) return res.status(400).json({ msg: "Username already in use" });
      user.username = req.body.username;
    }

    // Safe fields update
    if (Object.prototype.hasOwnProperty.call(req.body, "firstName"))
      user.firstName = req.body.firstName;
    if (Object.prototype.hasOwnProperty.call(req.body, "lastName"))
      user.lastName = req.body.lastName;
    if (Object.prototype.hasOwnProperty.call(req.body, "phone"))
      user.phone = req.body.phone;

    // Admin may set role (enforce allowed values)
    if (isAdmin && Object.prototype.hasOwnProperty.call(req.body, "role")) {
      const allowed = ["admin", "manager", "staff"];
      const desired = String(req.body.role || "").toLowerCase();
      if (!allowed.includes(desired)) {
        return res.status(400).json({ msg: "Invalid role" });
      }
      user.role = desired;
    }

    // Password change (hash)
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    await user.save();

    // return safe view (no password)
    const safe = {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      disabled: !!user.disabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return res.json({ ok: true, user: safe });
  } catch (err) {
    console.error("updateUser error:", err);
    return res.status(500).json({ msg: err.message || "Server error" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    // Only allow self or admin to view
    if (req.user.id !== id && req.user.role !== "admin") {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    return res.json({ ok: true, user });
  } catch (err) {
    console.error("getUserById error:", err);
    return res.status(500).json({ msg: err.message || "Server error" });
  }
};
