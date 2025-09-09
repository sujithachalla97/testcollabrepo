// controllers/productController.js
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Supplier from "../models/Supplier.js"; // new import for supplier snapshot

const asArray = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export const createProduct = async (req, res) => {
  try {
    const body = req.body || {};

    // Accept both camelCase and old CSV-style keys on create (best-effort)
    if (!body.modelNumber && body.ModelNumber) body.modelNumber = body.ModelNumber;
    if (!body.productName && body.ProductName) body.productName = body.ProductName;
    if (!body.productImage && body.ProductImage) body.productImage = body.ProductImage;
    if (!body.productCategoryName && (body.ProductCateogyName || body["Product Cateogy Name"])) {
      body.productCategoryName = body.ProductCateogyName || body["Product Cateogy Name"];
    }

    if (!body.modelNumber || !body.productName) {
      return res.status(400).json({ error: "modelNumber and productName required" });
    }

    body.productImage = asArray(body.productImage);
    body.stockLevel = body.stockLevel !== undefined ? Number(body.stockLevel) : 0;
    body.reorderPoint = body.reorderPoint !== undefined ? Number(body.reorderPoint) : 0;

    // If supplierId provided, attach supplier snapshot into the product doc
    if (body.supplierId) {
      try {
        const sup = await Supplier.findById(body.supplierId).lean().catch(() => null);
        if (sup) {
          body.supplierId = sup._id;
          body.supplierName = sup.supplierName || body.supplierName || "";
          body.supplierMail = sup.supplierMail || body.supplierMail || "";
          body.supplierContact = sup.supplierContact || body.supplierContact || "";
        } else {
          // fallback: keep any supplierName values provided in body
          body.supplierName = body.supplierName || "";
          body.supplierMail = body.supplierMail || "";
          body.supplierContact = body.supplierContact || "";
        }
      } catch (e) {
        // ignore supplier lookup failure, proceed with provided fields
        body.supplierName = body.supplierName || "";
        body.supplierMail = body.supplierMail || "";
        body.supplierContact = body.supplierContact || "";
      }
    } else {
      body.supplierName = body.supplierName || "";
      body.supplierMail = body.supplierMail || "";
      body.supplierContact = body.supplierContact || "";
    }

    const p = await Product.create(body);
    res.status(201).json(p);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "modelNumber must be unique" });
    res.status(500).json({ error: err.message });
  }
};

export const listProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(200, parseInt(req.query.limit || "25", 10));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.q) {
      // prefer full text if available
      filter.$text = { $search: req.query.q };
    }

    const [items, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      Product.countDocuments(filter)
    ]);
    res.json({ page, limit, total, items });
  } catch (err) {
    console.error("listProducts error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getProductByModel = async (req, res) => {
  try {
    const model = req.params.model;
    // tolerant lookup: check camelCase and legacy names
    const p = await Product.findOne({
      $or: [
        { modelNumber: model },
        { ModelNumber: model },
        { "Model Number": model }
      ]
    }).lean();
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  } catch (err) {
    console.error("getProductByModel error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const model = req.params.model;
    const updates = req.body || {};

    // accept legacy keys in update payload
    if (updates.ModelNumber && !updates.modelNumber) updates.modelNumber = updates.ModelNumber;
    if (updates.ProductName && !updates.productName) updates.productName = updates.ProductName;
    if (updates.ProductImage && !updates.productImage) updates.productImage = updates.ProductImage;
    if ((updates.ProductCateogyName || updates["Product Cateogy Name"]) && !updates.productCategoryName) {
      updates.productCategoryName = updates.ProductCateogyName || updates["Product Cateogy Name"];
    }

    if (updates.productImage && !Array.isArray(updates.productImage)) updates.productImage = asArray(updates.productImage);
    if (updates.stockLevel !== undefined) updates.stockLevel = Number(updates.stockLevel);
    if (updates.reorderPoint !== undefined) updates.reorderPoint = Number(updates.reorderPoint);

    // If supplierId provided on update, refresh snapshot
    if (updates.supplierId) {
      try {
        const sup = await Supplier.findById(updates.supplierId).lean().catch(() => null);
        if (sup) {
          updates.supplierName = sup.supplierName || updates.supplierName || "";
          updates.supplierMail = sup.supplierMail || updates.supplierMail || "";
          updates.supplierContact = sup.supplierContact || updates.supplierContact || "";
        }
      } catch (e) {
        // ignore supplier lookup failure
      }
    }

    const p = await Product.findOneAndUpdate(
      { $or: [{ modelNumber: model }, { ModelNumber: model }, { "Model Number": model }] },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  } catch (err) {
    console.error("updateProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const model = req.params.model;
    const p = await Product.findOneAndDelete({ $or: [{ modelNumber: model }, { ModelNumber: model }, { "Model Number": model }] });
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("deleteProduct error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const bulkRestock = async (req, res) => {
  try {
    const { items, models, qty } = req.body;
    const ops = [];

    if (Array.isArray(items)) {
      for (const it of items) {
        const model = it.modelNumber ?? it.model;
        const q = Number(it.qty ?? it.quantity ?? 0);
        if (!model || !Number.isFinite(q) || q <= 0) continue;
        ops.push({
          updateOne: {
            filter: { modelNumber: model },
            update: { $inc: { stockLevel: q } },
          },
        });
      }
    } else if (Array.isArray(models) && Number.isFinite(Number(qty)) && Number(qty) > 0) {
      const q = Number(qty);
      for (const model of models) {
        if (!model) continue;
        ops.push({
          updateOne: {
            filter: { modelNumber: model },
            update: { $inc: { stockLevel: q } },
          },
        });
      }
    } else {
      return res.status(400).json({
        error:
          "Invalid payload. Send items: [{ modelNumber, qty }] OR models: [..] with qty.",
      });
    }

    if (ops.length === 0) {
      return res.status(400).json({ error: "No valid operations to perform." });
    }

    // Execute bulkWrite (ordered:false to continue on errors)
    const result = await Product.bulkWrite(ops, { ordered: false });

    // Build a small friendly summary (fields vary by driver/version so we normalize)
    const summary = {
      matchedCount: result.matchedCount ?? result.nMatched ?? null,
      modifiedCount: result.modifiedCount ?? result.nModified ?? null,
      upsertedCount: result.upsertedCount ?? result.nUpserted ?? 0,
      ok: result.ok ?? true,
    };

    return res.json({ success: true, summary, raw: result });
  } catch (err) {
    console.error("bulkRestock error:", err);
    return res.status(500).json({ error: err.message || "Bulk restock failed" });
  }
};

const genOrderNumber = () => `PO-${Date.now().toString(36).toUpperCase()}`;

/**
 * bulkRestockWithOrder
 * - increments product stock
 * - creates an Order document that includes supplier snapshot fields (supplierName, supplierMail, supplierContact)
 */
export const bulkRestockWithOrder = async (req, res) => {
  const payload = req.body || {};
  const itemsIn = Array.isArray(payload.items) ? payload.items : [];
  const models = Array.isArray(payload.models) ? payload.models : null;
  const qtyGlobal = Number(payload.qty || 0);

  // normalize items
  let items = [];
  if (itemsIn.length > 0) {
    items = itemsIn
      .map((it) => ({
        modelNumber: (it.modelNumber || it.model || "").toString(),
        qty: Number(it.qty ?? it.quantity ?? 0),
        unitCost: Number(it.unitCost ?? 0),
      }))
      .filter((it) => it.modelNumber && Number.isFinite(it.qty) && it.qty > 0);
  } else if (models && Number.isFinite(qtyGlobal) && qtyGlobal > 0) {
    items = models.filter(Boolean).map((m) => ({ modelNumber: m.toString(), qty: qtyGlobal, unitCost: 0 }));
  } else {
    return res.status(400).json({ error: "Invalid payload. Provide items:[{modelNumber,qty}] or models:[..] with qty." });
  }

  if (items.length === 0) return res.status(400).json({ error: "No valid items provided." });

  const ops = items.map((it) => ({
    updateOne: { filter: { modelNumber: it.modelNumber }, update: { $inc: { stockLevel: it.qty } } },
  }));

  // prepare supplier snapshot
  let supplierSnapshot = null;
  if (payload.supplierId) {
    try {
      const sup = await Supplier.findById(payload.supplierId).lean().catch(() => null);
      if (sup) {
        supplierSnapshot = {
          supplierId: sup._id,
          supplierName: sup.supplierName || "",
          supplierMail: sup.supplierMail || "",
          supplierContact: sup.supplierContact || "",
        };
      }
    } catch (e) {
      // ignore supplier lookup failure; order will include supplierId only if provided
    }
  }

  // try transaction if available
  const session = await mongoose.startSession().catch(() => null);
  let bulkResult = null;
  let createdOrder = null;
  try {
    if (session && session.startTransaction) {
      await session.withTransaction(async () => {
        bulkResult = await Product.bulkWrite(ops, { ordered: false, session });

        const modelNumbers = items.map((i) => i.modelNumber);
        const prods = await Product.find({ modelNumber: { $in: modelNumbers } }).lean().session(session);
        const prodByModel = {};
        prods.forEach((p) => (prodByModel[p.modelNumber] = p));

        const orderItems = items.map((it) => {
          const p = prodByModel[it.modelNumber];
          const name = p?.productName ?? "";
          const totalCost = (Number(it.unitCost) || 0) * Number(it.qty || 0);
          return { modelNumber: it.modelNumber, productName: name, qty: it.qty, unitCost: Number(it.unitCost || 0), totalCost };
        });

        const subtotal = orderItems.reduce((s, it) => s + (it.totalCost || 0), 0);

        const orderDoc = {
          orderNumber: genOrderNumber(),
          type: "restock",
          status: payload.status || "received",
          items: orderItems,
          subtotal,
          notes: payload.notes || "",
          createdBy: payload.createdBy || null,
          ...supplierSnapshot, // attach snapshot fields if present
          supplierId: supplierSnapshot?.supplierId ?? (payload.supplierId ?? null),
        };

        const [o] = await Order.create([orderDoc], { session });
        createdOrder = o;
      });
      await session.endSession();
    } else {
      // no transaction support — best-effort
      bulkResult = await Product.bulkWrite(ops, { ordered: false });
      const modelNumbers = items.map((i) => i.modelNumber);
      const prods = await Product.find({ modelNumber: { $in: modelNumbers } }).lean();
      const prodByModel = {};
      prods.forEach((p) => (prodByModel[p.modelNumber] = p));
      const orderItems = items.map((it) => {
        const p = prodByModel[it.modelNumber];
        const name = p?.productName ?? "";
        const totalCost = (Number(it.unitCost) || 0) * Number(it.qty || 0);
        return { modelNumber: it.modelNumber, productName: name, qty: it.qty, unitCost: Number(it.unitCost || 0), totalCost };
      });
      const subtotal = orderItems.reduce((s, it) => s + (it.totalCost || 0), 0);

      const orderDoc = {
        orderNumber: genOrderNumber(),
        type: "restock",
        status: payload.status || "received",
        items: orderItems,
        subtotal,
        notes: payload.notes || "",
        createdBy: payload.createdBy || null,
        ...supplierSnapshot,
        supplierId: supplierSnapshot?.supplierId ?? (payload.supplierId ?? null),
      };

      createdOrder = await Order.create(orderDoc);
    }

    return res.json({ success: true, bulkResult, order: createdOrder });
  } catch (err) {
    console.error("bulkRestockWithOrder error:", err);
    if (session && session.inTransaction()) {
      try { await session.abortTransaction(); } catch (e) {}
      await session.endSession();
    }
    return res.status(500).json({ error: err.message || "Bulk restock failed" });
  }
};
