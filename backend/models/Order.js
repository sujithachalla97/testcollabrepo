// models/Order.js (snippet)
import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  modelNumber: String,
  productName: String,
  qty: Number,
  unitCost: Number,
  totalCost: Number,
  productSnapshot: { type: mongoose.Schema.Types.Mixed, default: null } // will hold supplierName etc.
});

const OrderSchema = new mongoose.Schema({
  orderNumber: String,
  type: String,
  items: [ItemSchema],
  subtotal: Number,
  status: String,
  supplierName: { type: String, default: null }, // new
}, { timestamps: true });

export default mongoose.model("Order", OrderSchema);
