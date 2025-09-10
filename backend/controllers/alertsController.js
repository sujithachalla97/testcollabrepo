// controllers/alertsController.js
import Product from "../models/Product.js";

/**
 * getLowStockProducts
 * - returns products where stockLevel <= reorderPoint
 * - supports ?limit & ?skip & ?q (text search) & ?onlyUnacked=true
 */
export async function getLowStockProducts(req, res) {
  try {
    const { limit = 200, skip = 0, q, onlyUnacked } = req.query;
    const base = {
      $expr: { $lte: ["$stockLevel", "$reorderPoint"] },
      status: { $ne: "discontinued" },
    };
    if (q) {
      base.$text = { $search: q };
    }
    if (onlyUnacked === "true") {
      base.lowStockAcknowledgedAt = null;
    }

    const products = await Product.find(base)
      .sort({ stockLevel: 1 })
      .skip(Number(skip))
      .limit(Math.min(1000, Number(limit)))
      .lean();

    // include helpful computed fields
    const items = products.map((p) => ({
      _id: p._id,
      modelNumber: p.modelNumber,
      productName: p.productName,
      stockLevel: p.stockLevel,
      reorderPoint: p.reorderPoint,
      short: `${p.modelNumber} — ${p.productName}`,
      lowBy: p.stockLevel - p.reorderPoint, // <= 0 means low
      lowStockAcknowledgedAt: p.lowStockAcknowledgedAt || null,
      lowStockAcknowledgedBy: p.lowStockAcknowledgedBy || "",
      updatedAt: p.updatedAt,
    }));

    res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /alerts/low-stock error", err);
    res.status(500).json({ ok: false, error: "Failed to load alerts" });
  }
}

/**
 * acknowledgeLowStock
 * body: { productIds: [id], user: "nameOrId" }
 */
export async function acknowledgeLowStock(req, res) {
  try {
    const { productIds = [], user = "" } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ ok: false, error: "No productIds provided" });
    }

    const now = new Date();
    await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { lowStockAcknowledgedAt: now, lowStockAcknowledgedBy: user } }
    );

    res.json({ ok: true, acknowledgedAt: now });
  } catch (err) {
    console.error("POST /alerts/acknowledge error", err);
    res.status(500).json({ ok: false, error: "Failed to acknowledge" });
  }
}

/**
 * updateReorderPoint
 * PATCH /products/:id/reorderPoint body: { reorderPoint: Number }
 */
export async function updateReorderPoint(req, res) {
  try {
    const { id } = req.params;
    const { reorderPoint } = req.body;
    if (typeof reorderPoint !== "number") {
      return res.status(400).json({ ok: false, error: "reorderPoint must be a number" });
    }
    const p = await Product.findByIdAndUpdate(id, { reorderPoint, lowStockAcknowledgedAt: null }, { new: true }).lean();
    if (!p) return res.status(404).json({ ok: false, error: "Product not found" });
    res.json({ ok: true, product: p });
  } catch (err) {
    console.error("PATCH /products/:id/reorderPoint error", err);
    res.status(500).json({ ok: false, error: "Failed to update reorderPoint" });
  }
}
