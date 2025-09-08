import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },   // UserName
  password: { type: String, required: true },                 // Plain here, hash via controller
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, enum: ["Admin", "Manager", "Staff"], required: true },
  phone: { type: String },
  email: { type: String, unique: true }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", userSchema);
