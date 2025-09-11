// controllers/orderController.js
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import PDFDocument from "pdfkit";

/* ----------------- helpers ----------------- */

// build product snapshot (matches your Product schema)
const buildProductSnapshot = (p = {}) => ({
  id: p?._id ?? null,
  modelNumber: p?.modelNumber ?? "",
  productName: p?.productName ?? p?.name ?? "",
  supplierName: p?.supplierName ?? "",
  supplierMail: p?.supplierMail ?? "",
  supplierContact: p?.supplierContact ?? "",
});

// fill items with productSnapshot - supports productId OR modelNumber OR productName
const fillItemsWithSnapshots = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return items;

  // collect search buckets
  const ids = items.map((it) => it.productId).filter(Boolean);
  const modelNumbers = items.map((it) => it.modelNumber).filter(Boolean);
  const names = items.map((it) => it.productName).filter(Boolean);

  // build query ORs but avoid empty arrays
  const or = [];
  if (ids.length) or.push({ _id: { $in: ids } });
  if (modelNumbers.length) or.push({ modelNumber: { $in: modelNumbers } });
  if (names.length) or.push({ $or: [{ productName: { $in: names } }, { name: { $in: names } }] });

  const products = or.length ? await Product.find({ $or: or }).lean() : [];

  // build map by _id, modelNumber, productName/name
  const prodMap = new Map();
  for (const p of products) {
    if (p._id) prodMap.set(String(p._id), p);
    if (p.modelNumber) prodMap.set(p.modelNumber, p);
    if (p.productName) prodMap.set(p.productName, p);
    if (p.name) prodMap.set(p.name, p);
  }

  // attach snapshot for each item using best matching key
  return items.map((it) => {
    let p = null;
    if (it.productId && prodMap.has(String(it.productId))) p = prodMap.get(String(it.productId));
    else if (it.modelNumber && prodMap.has(it.modelNumber)) p = prodMap.get(it.modelNumber);
    else if (it.productName && prodMap.has(it.productName)) p = prodMap.get(it.productName);
    // fallback: keep existing snapshot if any
    const snapshot = p ? buildProductSnapshot(p) : it.productSnapshot || null;
    return { ...it, productSnapshot: snapshot };
  });
};

/**
 * Apply deleted filter so that:
 * - deleted=true returns only deleted documents
 * - deleted!=true (default) returns documents where deleted is false OR missing
 *
 * This merges safely with existing query objects by pushing into $and when necessary.
 */
const applyDeletedFilter = (queryObj, deletedFlag) => {
  if (deletedFlag === "true") {
    // only deleted docs
    queryObj.deleted = true;
  } else {
    // include docs where deleted is false OR field missing
    // use $and to avoid clobbering existing $or search
    if (!queryObj.$and) queryObj.$and = [];
    queryObj.$and.push({ $or: [{ deleted: false }, { deleted: { $exists: false } }] });
  }
};

/* ----------------- controllers ----------------- */

// Create order
export const createOrder = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.items = await fillItemsWithSnapshots(payload.items || []);
    payload.supplierName = payload.items?.[0]?.productSnapshot?.supplierName || null;

    const order = new Order(payload);
    await order.save();

    const out = await Order.findById(order._id).lean();
    res.status(201).json({
      ...out,
      supplierResolved: out.supplierName || out.items?.[0]?.productSnapshot?.supplierName || null,
    });
  } catch (err) {
    console.error("createOrder error:", err);
    res.status(400).json({ error: err.message });
  }
};

// List orders (pagination + supplierResolved fallback)
// kept for backward compatibility if used elsewhere
export const listOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(200, parseInt(req.query.limit || "10", 10));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.q) {
      filter.$or = [
        { orderNumber: { $regex: req.query.q, $options: "i" } },
        { notes: { $regex: req.query.q, $options: "i" } },
      ];
    }
    if (req.query.type && req.query.type !== "all") filter.type = req.query.type;
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;

    // apply deleted filter robustly (treat missing as false)
    applyDeletedFilter(filter, req.query.deleted);

    const [items, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    // supplierResolved best-effort: snapshot -> supplierName -> live lookup by first item's modelNumber
    const normalized = await Promise.all(
      items.map(async (it) => {
        const fromSnapshot = it.items?.[0]?.productSnapshot?.supplierName || it.supplierName || null;
        if (fromSnapshot) return { ...it, supplierResolved: fromSnapshot };

        // try live lookup using first item's identifiers
        const first = it.items?.[0];
        if (first) {
          const pid = first.productId || null;
          const mn = first.modelNumber || null;
          const name = first.productName || null;
          let p = null;
          if (pid) p = await Product.findById(pid).lean().catch(() => null);
          if (!p && mn) p = await Product.findOne({ modelNumber: mn }).lean().catch(() => null);
          if (!p && name) p = await Product.findOne({ $or: [{ productName: name }, { name: name }] }).lean().catch(() => null);
          if (p) return { ...it, supplierResolved: p.supplierName || null };
        }

        return { ...it, supplierResolved: null };
      })
    );

    res.json({ page, limit, total, items: normalized });
  } catch (err) {
    console.error("listOrders error:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET /orders (supports deleted=true)
export const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, q = "", type, status, deleted = "false" } = req.query;

    const query = {};

    // search
    if (q) {
      query.$or = [
        { orderNumber: new RegExp(q, "i") },
        { notes: new RegExp(q, "i") },
        { "items.productName": new RegExp(q, "i") },
        { "items.modelNumber": new RegExp(q, "i") },
      ];
    }

    // filters
    if (type) query.type = type;
    if (status) query.status = status;

    // apply deleted filter: treats missing deleted as false
    applyDeletedFilter(query, deleted);

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Order.countDocuments(query),
    ]);

    res.json({ page: Number(page), limit: Number(limit), total, items });
  } catch (err) {
    console.error("getOrders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single order
export const getOrder = async (req, res) => {
  try {
    const o = await Order.findById(req.params.id).lean();
    if (!o) return res.status(404).json({ error: "Order not found" });

    let supplierResolved = o.supplierName || o.items?.[0]?.productSnapshot?.supplierName || null;

    // best-effort: if missing, try to fetch product via modelNumber/productName for first item
    if (!supplierResolved && o.items?.[0]) {
      const first = o.items[0];
      const pid = first.productId || null;
      const mn = first.modelNumber || null;
      const name = first.productName || null;
      let p = null;
      if (pid) p = await Product.findById(pid).lean().catch(() => null);
      if (!p && mn) p = await Product.findOne({ modelNumber: mn }).lean().catch(() => null);
      if (!p && name) p = await Product.findOne({ $or: [{ productName: name }, { name: name }] }).lean().catch(() => null);
      if (p) {
        // attach snapshot in response (doesn't persist)
        o.items[0].productSnapshot = buildProductSnapshot(p);
        supplierResolved = p.supplierName || null;
      }
    }

    res.json({ ...o, supplierResolved });
  } catch (err) {
    console.error("getOrder error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Update order
export const updateOrder = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (Array.isArray(payload.items)) {
      payload.items = await fillItemsWithSnapshots(payload.items);
      payload.supplierName = payload.items?.[0]?.productSnapshot?.supplierName || null;
    }

    const order = await Order.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });

    res.json({
      ...order,
      supplierResolved: order.supplierName || order.items?.[0]?.productSnapshot?.supplierName || null,
    });
  } catch (err) {
    console.error("updateOrder error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Soft Delete order (marks deleted=true, sets deletedAt & deletedBy)
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // idempotent: if already deleted, just return success
    if (order.deleted) {
      return res.json({ message: "Order already deleted" });
    }

    order.deleted = true;
    order.deletedAt = new Date();
    // attach user id if available (requires auth middleware that sets req.user)
    if (req.user && req.user.id) order.deletedBy = req.user.id;
    await order.save();

    res.json({ message: "Order marked as deleted" });
  } catch (err) {
    console.error("deleteOrder error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Restore order (undo soft-delete)
export const restoreOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!order.deleted) {
      return res.json({ message: "Order is not deleted" });
    }

    order.deleted = false;
    order.deletedAt = null;
    order.deletedBy = null;
    await order.save();

    res.json({ message: "Order restored" });
  } catch (err) {
    console.error("restoreOrder error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Hard purge (permanently remove) - use with caution, restrict to admins
export const purgeOrder = async (req, res) => {
  try {
    // optionally protect with role check outside this controller
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Order permanently deleted" });
  } catch (err) {
    console.error("purgeOrder error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Pretty invoice PDF generator using PDFKit.
 * Streams a well-styled invoice to the response.
 */
export const getOrderInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });

    // invoice metadata
    const invoiceNumber = order.orderNumber || `INV-${String(order._id).slice(-6).toUpperCase()}`;
    const invoiceDate = order.createdAt ? new Date(order.createdAt) : new Date();
    const company = {
      name: process.env.COMPANY_NAME || "Your Company Pvt. Ltd.",
      address: process.env.COMPANY_ADDRESS || "123, Main Street, City, Country",
      phone: process.env.COMPANY_PHONE || "000-000-0000",
      email: process.env.COMPANY_EMAIL || "sales@company.com",
      // optional logo URL (not embedded; requires fetching and embedding if desired)
      logoUrl: process.env.COMPANY_LOGO_URL || null,
    };

    // supplier info (best-effort)
    const supplier = {
      name: order.supplierName || order.items?.[0]?.productSnapshot?.supplierName || "Supplier",
      email: order.items?.[0]?.productSnapshot?.supplierMail || "",
      phone: order.items?.[0]?.productSnapshot?.supplierContact || "",
    };

    // prepare items table (ensure numbers)
    const items = (order.items || []).map((it) => ({
      model: it.modelNumber || "",
      name: it.productName || it.productSnapshot?.productName || "",
      qty: Number(it.qty || 0),
      unit: Number(it.unitCost || 0),
      total: Number(it.totalCost ?? (it.qty || 0) * (it.unitCost || 0)),
      supplier: it.productSnapshot?.supplierName || "",
    }));

    // financials
    const computedSubtotal = items.reduce((s, it) => s + (it.total || 0), 0);
    // you can set tax rate in env or order.tax
    const taxRate = Number(order.taxRate ?? process.env.INVOICE_TAX_RATE ?? 0) || 0;
    const taxAmount = +(computedSubtotal * (taxRate / 100));
    const grandTotal = +(computedSubtotal + taxAmount);

    // create PDF doc
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

    // set headers to stream back PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoiceNumber}.pdf`);
    doc.pipe(res);

    // helpers
    const currency = (v) => `₹ ${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // --- Header: logo/company
    const topY = 40;
    if (company.logoUrl) {
      // If you want to embed remote logo, fetch it and use doc.image(buffer)... (left as optional)
      doc.rect(40, topY, 120, 50).stroke(); // placeholder box if no logo embedding
    } else {
      doc.fontSize(18).font("Helvetica-Bold").text(company.name, 40, topY);
    }

    // company contact (right side)
    doc.fontSize(9).font("Helvetica").text(company.address, 0, topY, { align: "right" });
    doc.text(`Phone: ${company.phone}`, { align: "right" });
    doc.text(`Email: ${company.email}`, { align: "right" });

    // big INVOICE title
    doc.moveDown(1.2);
    doc.fontSize(20).font("Helvetica-Bold").text("INVOICE", 40, 110);

    // invoice meta on right
    doc.fontSize(10).font("Helvetica");
    doc.text(`Invoice #: ${invoiceNumber}`, 400, 110);
    doc.text(`Date: ${invoiceDate.toLocaleDateString()}`, 400, 125);
    if (order.status) doc.text(`Status: ${order.status}`, 400, 140);

    // --- From / To boxes
    const blockY = 160;
    const blockHeight = 70;
    // FROM (company)
    doc.roundedRect(40, blockY, 260, blockHeight, 4).stroke();
    doc.fontSize(10).font("Helvetica-Bold").text("From", 48, blockY + 8);
    doc.fontSize(9).font("Helvetica").text(company.name, 48, blockY + 24);
    doc.text(company.address, 48, blockY + 38);

    // TO (supplier / bill-to)
    doc.roundedRect(320, blockY, 220, blockHeight, 4).stroke();
    doc.fontSize(10).font("Helvetica-Bold").text("Bill To", 328, blockY + 8);
    doc.fontSize(9).font("Helvetica").text(supplier.name || "-", 328, blockY + 24);
    if (supplier.email) doc.text(`Email: ${supplier.email}`, 328, blockY + 38);
    if (supplier.phone) doc.text(`Phone: ${supplier.phone}`, 328, blockY + 52);

    // --- Items table header
    let tableTop = blockY + blockHeight + 24;
    const marginLeft = 40;
    const tableWidth = 515; // A4 => width - margins
    const col = {
      model: marginLeft,
      product: marginLeft + 80,
      qty: marginLeft + 320,
      unit: marginLeft + 370,
      total: marginLeft + 450,
    };

    // header background
    doc.rect(marginLeft, tableTop - 6, tableWidth, 24).fillAndStroke("#F3F4F6", "#E5E7EB");
    doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold");
    doc.text("Model", col.model + 4, tableTop);
    doc.text("Product", col.product + 4, tableTop);
    doc.text("Qty", col.qty + 4, tableTop);
    doc.text("Unit", col.unit + 4, tableTop, { width: 70, align: "right" });
    doc.text("Total", col.total + 4, tableTop, { width: 70, align: "right" });

    // reset fill
    doc.fillColor("black").font("Helvetica").fontSize(9);

    // draw rows
    let y = tableTop + 28;
    const rowHeight = 20;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];

      // page break handling
      if (y + 80 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = 60; // reset y on new page
      }

      // alternating row bg
      if (i % 2 === 0) {
        doc.rect(marginLeft, y - 4, tableWidth, rowHeight).fill("#FFFFFF");
      } else {
        doc.rect(marginLeft, y - 4, tableWidth, rowHeight).fill("#FAFAFB");
      }
      doc.fillColor("#111827");

      // row columns
      doc.text(it.model || "-", col.model + 4, y);
      doc.text(it.name || "-", col.product + 4, y, { width: col.qty - col.product - 8 });
      doc.text(String(it.qty || 0), col.qty + 4, y, { width: 30, align: "right" });
      doc.text(currency(it.unit), col.unit, y, { width: 80, align: "right" });
      doc.text(currency(it.total), col.total, y, { width: 80, align: "right" });

      y += rowHeight;
    }

    // draw table border bottom
    doc.strokeColor("#E5E7EB").lineWidth(0.5).moveTo(marginLeft, y - 6).lineTo(marginLeft + tableWidth, y - 6).stroke();

    // --- totals block (right aligned)
    const totalsX = marginLeft + tableWidth - 200;
    let totalsY = y + 10;
    doc.fontSize(9).font("Helvetica");
    doc.text("Subtotal:", totalsX, totalsY, { width: 120, align: "left" });
    doc.text(currency(computedSubtotal), totalsX + 120, totalsY, { width: 80, align: "right" });
    totalsY += 18;
    if (taxRate) {
      doc.text(`Tax (${taxRate}%):`, totalsX, totalsY, { width: 120, align: "left" });
      doc.text(currency(taxAmount), totalsX + 120, totalsY, { width: 80, align: "right" });
      totalsY += 18;
    }
    doc.font("Helvetica-Bold").text("Grand Total:", totalsX, totalsY, { width: 120, align: "left" });
    doc.text(currency(grandTotal), totalsX + 120, totalsY, { width: 80, align: "right" });

    // --- footer / notes / signature
    let footY = Math.max(totalsY + 40, 520);
    doc.font("Helvetica").fontSize(9).fillColor("#374151");
    doc.text(order.notes ? `Notes: ${order.notes}` : "Thank you for your business!", 40, footY, { width: 360 });
    doc.text("Authorized signature:", 420, footY, { width: 120, align: "left" });
    doc.moveTo(420, footY + 36).lineTo(560, footY + 36).stroke();

    // page numbers (if multiple pages)
    const pages = doc.bufferedPageRange(); // { start: 0, count: n }
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor("#6B7280").text(`Page ${i + 1} of ${pages.count}`, 40, doc.page.height - 30, { align: "center", width: doc.page.width - 80 });
    }

    doc.end();
  } catch (err) {
    console.error("getOrderInvoice error:", err);
    res.status(500).json({ error: err.message });
  }
};
