// routes/transactions.js
import express from "express";
import Transaction from "../models/Transaction.js";
import Product from "../models/Product.js";
import { changeStockBatch } from "../controllers/transactionController.js";

const router = express.Router();

/**
 * GET /transactions
 * Optional query:
 *  - modelNumber
 *  - limit (default 200)
 *  - skip
 */
router.get("/", async (req, res) => {
  try {
    const { modelNumber, limit = 200, skip = 0 } = req.query;
    const q = {};
    if (modelNumber) q["items.modelNumber"] = modelNumber;

    const items = await Transaction.find(q)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(1000, Number(limit)))
      .lean();

    res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /transactions error", err);
    res.status(500).json({ ok: false, error: "Failed to load transactions" });
  }
});

/**
 * POST /transactions/stockout
 * body: { items: [{ modelNumber, qty, unitCost }], notes, allowNegative, meta }
 */
router.post("/stockout", async (req, res) => {
  try {
    const { items = [], notes = "", allowNegative = false, meta = {} } = req.body;
    if (!items.length) return res.status(400).json({ ok: false, error: "No items provided" });

    const tx = await changeStockBatch({
      items,
      type: "stockout",
      options: { allowNegative: !!allowNegative, notes, meta },
    });

    res.json({ ok: true, tx });
  } catch (err) {
    console.error("POST /transactions/stockout error", err);
    if (err.code === "PRODUCT_NOT_FOUND") return res.status(404).json({ ok: false, error: err.message });
    if (err.code === "INSUFFICIENT_STOCK") return res.status(400).json({ ok: false, error: err.message });
    res.status(500).json({ ok: false, error: err.message || "Failed to record stockout" });
  }
});

/**
 * POST /transactions/restock
 * body: { items: [{ modelNumber, qty, unitCost }], notes, meta }
 */
router.post("/restock", async (req, res) => {
  try {
    const { items = [], notes = "", meta = {} } = req.body;
    if (!items.length) return res.status(400).json({ ok: false, error: "No items provided" });

    const tx = await changeStockBatch({
      items,
      type: "restock",
      options: { allowNegative: false, notes, meta },
    });

    res.json({ ok: true, tx });
  } catch (err) {
    console.error("POST /transactions/restock error", err);
    res.status(500).json({ ok: false, error: err.message || "Failed to record restock" });
  }
});

export default router;
