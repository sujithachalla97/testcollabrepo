// models/Order.js
import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  modelNumber: String,
  productName: String,
  qty: Number,
  unitCost: Number,
  totalCost: Number,
  productSnapshot: { type: mongoose.Schema.Types.Mixed, default: null }
});

const OrderSchema = new mongoose.Schema({
  orderNumber: String,
  type: String,
  items: [ItemSchema],
  subtotal: Number,
  status: String,
  supplierName: { type: String, default: null },

  // --- soft-delete fields (important) ---
  deleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  // optional: keep an audit object if you want
  // audit: { deletedHistory: [{ by: ObjectId, at: Date, note: String }] }
}, { timestamps: true });

export default mongoose.model("Order", OrderSchema);
