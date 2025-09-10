// controllers/managerController.js
import bcrypt from "bcrypt";
import User from "../models/User.js";

/**
 * Note: all controller actions assume the route is protected and
 * only accessible by admins (use authorizeRoles("admin")).
 */

export const listManagers = async (req, res) => {
  try {
    const { limit = 200, skip = 0, q } = req.query;
    const base = { role: { $in: ["manager"] } };
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

    const safe = users.map((u) => ({
      id: u._id,
      username: u.username,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      phone: u.phone,
      disabled: !!u.disabled,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    res.json({ ok: true, items: safe });
  } catch (err) {
    console.error("listManagers", err);
    res.status(500).json({ ok: false, error: "Failed to list managers" });
  }
};

// controllers/managerController.js
export const createManager = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, phone } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ ok: false, error: "email, password, firstName, lastName required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ ok: false, error: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      password: hashed,
      firstName,
      lastName,
      phone,
      role: "manager", // force manager role server-side
    });

    return res.status(201).json({
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("createManager ERROR:", err && err.stack ? err.stack : err);
    // try to provide the most useful message
    const message = err?.message || "Server error";
    return res.status(500).json({ ok: false, error: message });
  }
};


export const getManager = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findById(id).lean();
    if (!u) return res.status(404).json({ ok: false, error: "User not found" });
    res.json({
      ok: true,
      user: {
        id: u._id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        phone: u.phone,
        disabled: !!u.disabled,
      },
    });
  } catch (err) {
    console.error("getManager", err);
    res.status(500).json({ ok: false, error: "Failed to fetch manager" });
  }
};

export const updateManager = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = { ...req.body };

    // do not allow role escalation to admin from manager via this route unless caller is admin
    if (patch.role && patch.role === "admin" && req.user.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Only admin can assign admin role" });
    }

    // If password provided, hash it
    if (patch.password) {
      const salt = await bcrypt.genSalt(10);
      patch.password = await bcrypt.hash(patch.password, salt);
    } else {
      delete patch.password;
    }

    const u = await User.findByIdAndUpdate(id, patch, { new: true }).lean();
    if (!u) return res.status(404).json({ ok: false, error: "User not found" });

    res.json({
      ok: true,
      user: {
        id: u._id,
        email: u.email,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        phone: u.phone,
        disabled: !!u.disabled,
      },
    });
  } catch (err) {
    console.error("updateManager", err);
    res.status(500).json({ ok: false, error: "Failed to update manager" });
  }
};

export const disableManager = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findByIdAndUpdate(id, { disabled: true }, { new: true }).lean();
    if (!u) return res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, user: { id: u._id, disabled: u.disabled } });
  } catch (err) {
    console.error("disableManager", err);
    res.status(500).json({ ok: false, error: "Failed to disable manager" });
  }
};

export const enableManager = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findByIdAndUpdate(id, { disabled: false }, { new: true }).lean();
    if (!u) return res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, user: { id: u._id, disabled: u.disabled } });
  } catch (err) {
    console.error("enableManager", err);
    res.status(500).json({ ok: false, error: "Failed to enable manager" });
  }
};

export const deleteManager = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findByIdAndDelete(id);
    if (!u) return res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error("deleteManager", err);
    res.status(500).json({ ok: false, error: "Failed to delete manager" });
  }
};
