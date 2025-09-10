import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js"; // ⬅️ add this
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import transactionsRouter from "./routes/transactionRoutes.js";
import alertRoutes from "./routes/alertsRoutes.js";

import managerRoutes from "./routes/managerRoutes.js";
import staffRoutes from "./routes/staffRouter.js";
// import the controller
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
app.use("/api/suppliers", supplierRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionsRouter); 

app.use("/api/alerts", alertRoutes); //alerts routes
app.use("/api/managers", managerRoutes); //manager routes
app.use("/api/staff", staffRoutes); //staff routes
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
