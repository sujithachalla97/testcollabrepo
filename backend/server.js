import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js"; // ⬅️ add this
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// connect to MongoDB
connectDB();

// Basic route
app.get("/", (req, res) => {
  res.json({ msg: "Backend is running 🎉" });
});
app.use("/api/auth", authRoutes); //auth routes
app.use("/api/products", productRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
