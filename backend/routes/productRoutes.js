// routes/productRoutes.js
import express from "express";
import {
  createProduct,
  listProducts,
  getProductByModel,
  updateProduct,
  deleteProduct,
  bulkRestock,
  bulkRestockWithOrder
} from "../controllers/productController.js";

const router = express.Router();

// CRUD
router.post("/", createProduct);         // create
router.get("/", listProducts);           // list (page, limit, q)
router.get("/:model", getProductByModel);// get by modelNumber (or legacy)
router.patch("/:model", updateProduct);  // update
router.delete("/:model", deleteProduct); // delete
router.post("/bulk-restock", bulkRestock);
router.post("/bulk-restock-order", bulkRestockWithOrder);

export default router;
