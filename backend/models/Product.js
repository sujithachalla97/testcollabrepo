// models/Product.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ProductSchema = new Schema({
  productName:         { type: String, required: true, trim: true, index: true },
  description:         { type: String },
  productImage:        { type: [String], default: [] },
  productCategoryName: { type: String, index: true },

  modelNumber:         { type: String, required: true, unique: true, index: true },
  serialNumber:        { type: String, index: true },

  stockLevel:          { type: Number, default: 0 },
  reorderPoint:        { type: Number, default: 0 },

  status:              { type: String, enum: ["active", "draft", "discontinued"], default: "active" }
}, { timestamps: true });

ProductSchema.index({ productName: "text", description: "text" });

export default model("Product", ProductSchema);
