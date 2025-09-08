import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }, // Should be hashed before save
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { 
      type: String, 
      enum: ["admin", "manager", "staff"], 
      default: "staff", 
      required: true,
      lowercase: true   // ✅ Converts input to lowercase before saving
    },
    phone: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
