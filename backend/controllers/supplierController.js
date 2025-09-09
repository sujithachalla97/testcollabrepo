// controllers/supplierController.js
import Supplier from "../models/Supplier.js";

/**
 * Helpers
 */
const asArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Create Supplier
 * POST /suppliers
 */
export const createSupplier = async (req, res) => {
  try {
    const body = req.body || {};

    // tolerate legacy/CSV keys
    if (!body.supplierName && body.SupplierName) body.supplierName = body.SupplierName;
    if (!body.supplierMail && body.SupplierMail) body.supplierMail = body.SupplierMail;
    if (!body.supplierContact && body.SupplierContact) body.supplierContact = body.SupplierContact;

    if (!body.supplierName || !body.supplierMail || !body.supplierContact) {
      return res.status(400).json({ error: "supplierName, supplierMail and supplierContact required" });
    }

    // normalize
    body.supplierMail = String(body.supplierMail).toLowerCase();
    body.active = body.active === undefined ? true : !!body.active;

    const s = await Supplier.create(body);
    return res.status(201).json(s);
  } catch (err) {
    console.error("createSupplier:", err);
    if (err.code === 11000) return res.status(409).json({ error: "Duplicate key" });
    return res.status(500).json({ error: err.message });
  }
};

/**
 * List suppliers (paged + optional text search)
 * GET /suppliers?page=&limit=&q=
 * Returns: { page, limit, total, items }
 */
export const getSuppliers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(200, parseInt(req.query.limit || "25", 10));
    const skip = (page - 1) * limit;
    const filter = {};

    // prefer $text search if provided (requires text index in model)
    if (req.query.q) {
      // try text search; it's okay if text index is absent — Mongo will error if $text used without index,
      // but many deployments will have the index; fallback handled on client if necessary.
      filter.$text = { $search: req.query.q };
    }

    const [items, total] = await Promise.all([
      Supplier.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      Supplier.countDocuments(filter),
    ]);

    return res.json({ page, limit, total, items });
  } catch (err) {
    console.error("listSuppliers:", err);
    // If $text caused an error because index missing, attempt a regex fallback:
    if (err.message && err.message.includes("$text")) {
      try {
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const limit = Math.min(200, parseInt(req.query.limit || "25", 10));
        const skip = (page - 1) * limit;
        const qRaw = (req.query.q || "").trim();
        const filter = {};
        if (qRaw) {
          const re = new RegExp(escapeRegex(qRaw), "i");
          filter.$or = [
            { supplierName: re },
            { supplierMail: re },
            { supplierContact: re },
          ];
        }
        const [items, total] = await Promise.all([
          Supplier.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
          Supplier.countDocuments(filter),
        ]);
        return res.json({ page, limit, total, items });
      } catch (fallbackErr) {
        console.error("listSuppliers fallback error:", fallbackErr);
        return res.status(500).json({ error: fallbackErr.message });
      }
    }
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Get single supplier by id
 * GET /suppliers/:id
 */
export const getSupplier = async (req, res) => {
  try {
    const id = req.params.id;
    const s = await Supplier.findById(id).lean();
    if (!s) return res.status(404).json({ error: "Not found" });
    return res.json(s);
  } catch (err) {
    console.error("getSupplier:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Update supplier
 * PATCH /suppliers/:id
 */
export const updateSupplier = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body || {};

    // tolerate legacy keys
    if (updates.SupplierName && !updates.supplierName) updates.supplierName = updates.SupplierName;
    if (updates.SupplierMail && !updates.supplierMail) updates.supplierMail = updates.SupplierMail;
    if (updates.SupplierContact && !updates.supplierContact) updates.supplierContact = updates.SupplierContact;

    if (updates.supplierMail) updates.supplierMail = String(updates.supplierMail).toLowerCase();

    const s = await Supplier.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
    if (!s) return res.status(404).json({ error: "Not found" });
    return res.json(s);
  } catch (err) {
    console.error("updateSupplier:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Delete supplier
 * DELETE /suppliers/:id
 */
export const deleteSupplier = async (req, res) => {
  try {
    const id = req.params.id;
    const s = await Supplier.findByIdAndDelete(id);
    if (!s) return res.status(404).json({ error: "Not found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("deleteSupplier:", err);
    return res.status(500).json({ error: err.message });
  }
};
