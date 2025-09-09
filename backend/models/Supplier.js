// models/Supplier.js
import mongoose from "mongoose";

const SupplierSchema = new mongoose.Schema(
  {
    supplierName: { type: String, required: true, trim: true },
    supplierMail: { type: String, required: true, trim: true, lowercase: true },
    supplierContact: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Add a text index for faster search across main fields
SupplierSchema.index({ supplierName: "text", supplierMail: "text", supplierContact: "text" });

export default mongoose.model("Supplier", SupplierSchema);
