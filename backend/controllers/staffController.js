// controllers/staffController.js
import bcrypt from "bcrypt";
import User from "../models/User.js";

/**
 * Staff controller
 *
 * Roles/permissions:
 * - list/create/update: admin + manager
 * - disable/enable/delete: admin only
 */

export const listStaff = async (req, res) => {
  try {
    const { limit = 200, skip = 0, q } = req.query;
    const base = { role: "staff" };
    if (q) {
      base.$or = [
        { email: { $regex: q, $options: "i" } },
        { username: { $regex: q, $options: "i" } },
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
      ];
    }
    const users = await User.find(base)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(1000, Number(limit)))
      .lean();

    const items = users.map((u) => ({
      id: u._id,
      username: u.username,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      disabled: !!u.disabled,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    res.json({ ok: true, items });
  } catch (err) {
    console.error("listStaff", err);
    res.status(500).json({ ok: false, error: "Failed to list staff" });
  }
};

export const createStaff = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, phone } = req.body;
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ ok: false, error: "username, email, password, firstName, lastName required" });
    }

    // check email or username collisions
    const existsEmail = await User.findOne({ email });
    if (existsEmail) return res.status(400).json({ ok: false, error: "Email already exists" });

    const existsUsername = await User.findOne({ username });
    if (existsUsername) return res.status(400).json({ ok: false, error: "Username already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      password: hashed,
      firstName,
      lastName,
      phone,
      role: "staff",
    });

    res.status(201).json({
      ok: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("createStaff ERROR:", err);
    res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
};

export const getStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findById(id).lean();
    if (!u || u.role !== "staff") return res.status(404).json({ ok: false, error: "Staff not found" });
    res.json({
      ok: true,
      user: {
        id: u._id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        disabled: !!u.disabled,
      },
    });
  } catch (err) {
    console.error("getStaff", err);
    res.status(500).json({ ok: false, error: "Failed to fetch staff" });
  }
};

export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = { ...req.body };

    // disallow role changes here
    delete patch.role;

    // hash password when provided
    if (patch.password) {
      const salt = await bcrypt.genSalt(10);
      patch.password = await bcrypt.hash(patch.password, salt);
    } else {
      delete patch.password;
    }

    const u = await User.findByIdAndUpdate(id, patch, { new: true }).lean();
    if (!u || u.role !== "staff") return res.status(404).json({ ok: false, error: "Staff not found" });

    res.json({
      ok: true,
      user: {
        id: u._id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        disabled: !!u.disabled,
      },
    });
  } catch (err) {
    console.error("updateStaff", err);
    res.status(500).json({ ok: false, error: "Failed to update staff" });
  }
};

export const disableStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findByIdAndUpdate(id, { disabled: true }, { new: true }).lean();
    if (!u || u.role !== "staff") return res.status(404).json({ ok: false, error: "Staff not found" });
    res.json({ ok: true, user: { id: u._id, disabled: u.disabled } });
  } catch (err) {
    console.error("disableStaff", err);
    res.status(500).json({ ok: false, error: "Failed to disable staff" });
  }
};

export const enableStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findByIdAndUpdate(id, { disabled: false }, { new: true }).lean();
    if (!u || u.role !== "staff") return res.status(404).json({ ok: false, error: "Staff not found" });
    res.json({ ok: true, user: { id: u._id, disabled: u.disabled } });
  } catch (err) {
    console.error("enableStaff", err);
    res.status(500).json({ ok: false, error: "Failed to enable staff" });
  }
};

export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findById(id);
    if (!u || u.role !== "staff") return res.status(404).json({ ok: false, error: "Staff not found" });
    await u.remove();
    res.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error("deleteStaff", err);
    res.status(500).json({ ok: false, error: "Failed to delete staff" });
  }
};
