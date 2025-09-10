// routes/alerts.js
import express from "express";
import { getLowStockProducts, acknowledgeLowStock, updateReorderPoint } from "../controllers/alertsController.js";

const router = express.Router();

// helpful root endpoint (fallback)
router.get("/", (req, res) => {
  return res.json({
    ok: true,
    message: "Alerts API — available endpoints: GET /low-stock, POST /acknowledge, PATCH /products/:id/reorderPoint"
  });
});

router.get("/low-stock", getLowStockProducts);
router.post("/acknowledge", acknowledgeLowStock);
router.patch("/products/:id/reorderPoint", updateReorderPoint);

export default router;
