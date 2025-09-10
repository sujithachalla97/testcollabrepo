// models/Transaction.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const TransactionItemSchema = new Schema(
  {
    modelNumber: { type: String, required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: false }, // optional but recommended
    productName: { type: String, default: "" },
    qty: { type: Number, required: true },
    unitCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
  },
  { _id: false }
);

const TransactionSchema = new Schema(
  {
    type: { type: String, enum: ["stockout", "restock"], required: true },
    items: { type: [TransactionItemSchema], required: true },
    notes: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} }, // e.g. { orderId, userId }
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// indexes for queries
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ "items.modelNumber": 1 });

export default model("Transaction", TransactionSchema);
