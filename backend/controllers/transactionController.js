// controllers/stockController.js
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Transaction from "../models/Transaction.js";

/**
 * changeStockBatch
 * - items: [{ modelNumber, qty, unitCost }]
 * - type: 'stockout' | 'restock'
 * - options: { allowNegative, meta, notes }
 *
 * This updates product.stockLevel atomically per product and records a Transaction.
 */
export async function changeStockBatch({ items, type, options = {} }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // normalize items by modelNumber (sum qty when duplicates)
    const map = new Map();
    for (const it of items) {
      const key = it.modelNumber;
      const existing = map.get(key) || { ...it, qty: 0 };
      existing.qty += Number(it.qty || 0);
      existing.unitCost = it.unitCost ?? existing.unitCost ?? 0;
      existing.productName = it.productName ?? existing.productName ?? "";
      map.set(key, existing);
    }
    const normalized = Array.from(map.values());

    // resolve products for each modelNumber
    const modelNumbers = normalized.map((i) => i.modelNumber);
    const products = await Product.find({ modelNumber: { $in: modelNumbers } }).session(session);

    // Map product by modelNumber
    const prodByModel = new Map(products.map((p) => [p.modelNumber, p]));

    // Prepare DB updates
    for (const it of normalized) {
      const prod = prodByModel.get(it.modelNumber);
      if (!prod) {
        // if product missing on restock -> you might create product automatically (optional)
        throw Object.assign(new Error(`Product not found: ${it.modelNumber}`), { code: "PRODUCT_NOT_FOUND", modelNumber: it.modelNumber });
      }

      const delta = (type === "restock" ? 1 : -1) * Number(it.qty);
      const newStock = prod.stockLevel + delta;

      if (newStock < 0 && options.allowNegative !== true) {
        throw Object.assign(new Error(`Insufficient stock for ${it.modelNumber}`), { code: "INSUFFICIENT_STOCK", modelNumber: it.modelNumber });
      }

      prod.stockLevel = newStock;
      await prod.save({ session });
      // attach resolved product id/name back to item for transaction record
      it.product = prod._id;
      it.productName = prod.productName;
      it.totalCost = Number(it.unitCost || 0) * Number(it.qty || 0);
    }

    // create transaction record
    const tx = await Transaction.create(
      [
        {
          type,
          items: normalized,
          notes: options.notes || "",
          meta: options.meta || {},
          createdAt: options.createdAt || new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return tx[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}
