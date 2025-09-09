import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ProductSchema = new Schema(
  {
    productName: { type: String, required: true, trim: true, index: true },
    description: { type: String },
    productImage: { type: [String], default: [] },
    productCategoryName: { type: String, index: true },

    modelNumber: { type: String, required: true, unique: true, index: true },
    serialNumber: { type: String, index: true },

    stockLevel: { type: Number, default: 0 },
    reorderPoint: { type: Number, default: 0 },

    // 🔹 Supplier details (embedded for now, later can be ref if you want relation)
    supplierName: { type: String, required: true, trim: true },
    supplierMail: { 
      type: String, 
      required: true, 
      lowercase: true, 
      match: [/\S+@\S+\.\S+/, "Invalid email address"] 
    },
    supplierContact: { type: String, required: true, trim: true },

    // 🔹 Order details
    orderDate: { type: Date, default: Date.now },
    quantity: { type: Number, default: 1 },

    // 🔹 Product status
    status: { 
      type: String, 
      enum: ["active", "draft", "discontinued"], 
      default: "active" 
    },
  },
  { timestamps: true }
);

// Full-text search index
ProductSchema.index({ productName: "text", description: "text", productCategoryName: "text" });

export default model("Product", ProductSchema);
