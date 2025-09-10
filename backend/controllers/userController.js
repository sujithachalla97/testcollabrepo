// backend/controllers/user.controller.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
// backend/controllers/user.controller.js
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Update fields
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;
    user.phone = req.body.phone || user.phone;

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔒 Only allow self or admin to view
    if (req.user.id !== id && req.user.role !== "admin") {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const user = await User.findById(id).select("-password"); // don't send hashed password
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
