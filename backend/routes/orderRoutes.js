// routes/orders.js
import express from "express";
import { listOrders, getOrder, createOrder, updateOrder, deleteOrder,restoreOrder,purgeOrder } from "../controllers/orderController.js";
import { protect } from "../middleware/auth.js"; // uncomment if you want auth
import { getOrderInvoice } from "../controllers/orderController.js";
const router = express.Router();

router.get("/",  protect,  listOrders);
router.post("/", protect, createOrder);
router.get("/:id", protect,  getOrder);
router.patch("/:id", protect, updateOrder);
router.delete("/:id", protect, deleteOrder);
router.get("/:id/invoice", protect, getOrderInvoice);
router.post("/:id/restore", protect, restoreOrder);
router.delete("/:id/purge", protect, purgeOrder); // restrict to admins
router.get("/:id/invoice", protect, getOrderInvoice);
export default router;
