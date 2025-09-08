// controllers/productController.js
import Product from "../models/Product.js";

const asArray = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export const createProduct = async (req, res) => {
  try {
    const body = req.body || {};

    // Accept both camelCase and old CSV-style keys on create (best-effort)
    if (!body.modelNumber && body.ModelNumber) body.modelNumber = body.ModelNumber;
    if (!body.productName && body.ProductName) body.productName = body.ProductName;
    if (!body.productImage && body.ProductImage) body.productImage = body.ProductImage;
    if (!body.productCategoryName && (body.ProductCateogyName || body["Product Cateogy Name"])) {
      body.productCategoryName = body.ProductCateogyName || body["Product Cateogy Name"];
    }

    if (!body.modelNumber || !body.productName) {
      return res.status(400).json({ error: "modelNumber and productName required" });
    }

    body.productImage = asArray(body.productImage);
    body.stockLevel = body.stockLevel !== undefined ? Number(body.stockLevel) : 0;
    body.reorderPoint = body.reorderPoint !== undefined ? Number(body.reorderPoint) : 0;

    const p = await Product.create(body);
    res.status(201).json(p);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "modelNumber must be unique" });
    res.status(500).json({ error: err.message });
  }
};

export const listProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(200, parseInt(req.query.limit || "25", 10));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.q) filter.$text = { $search: req.query.q };

    const [items, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      Product.countDocuments(filter)
    ]);
    res.json({ page, limit, total, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProductByModel = async (req, res) => {
  try {
    const model = req.params.model;
    // tolerant lookup: check camelCase and legacy names
    const p = await Product.findOne({
      $or: [
        { modelNumber: model },
        { ModelNumber: model },
        { "Model Number": model }
      ]
    }).lean();
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const model = req.params.model;
    const updates = req.body || {};

    // accept legacy keys in update payload
    if (updates.ModelNumber && !updates.modelNumber) updates.modelNumber = updates.ModelNumber;
    if (updates.ProductName && !updates.productName) updates.productName = updates.ProductName;
    if (updates.ProductImage && !updates.productImage) updates.productImage = updates.ProductImage;
    if ((updates.ProductCateogyName || updates["Product Cateogy Name"]) && !updates.productCategoryName) {
      updates.productCategoryName = updates.ProductCateogyName || updates["Product Cateogy Name"];
    }

    if (updates.productImage && !Array.isArray(updates.productImage)) updates.productImage = asArray(updates.productImage);
    if (updates.stockLevel !== undefined) updates.stockLevel = Number(updates.stockLevel);
    if (updates.reorderPoint !== undefined) updates.reorderPoint = Number(updates.reorderPoint);

    const p = await Product.findOneAndUpdate(
      { $or: [{ modelNumber: model }, { ModelNumber: model }, { "Model Number": model }] },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const model = req.params.model;
    const p = await Product.findOneAndDelete({ $or: [{ modelNumber: model }, { ModelNumber: model }, { "Model Number": model }] });
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
