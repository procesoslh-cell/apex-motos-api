module.exports = function registerSalesRoutes(context) {
  const { app, db, createNotification, emailUserByName, fireAndForget } = context;

  function safeText(value) {
    return String(value || "").trim();
  }

  function getBudget(id) {
    const budget = db.prepare(`SELECT * FROM sales_budgets WHERE id = ?`).get(id);
    if (!budget) return null;
    const items = db.prepare(`SELECT * FROM sales_budget_items WHERE budget_id = ? ORDER BY id ASC`).all(id);
    return { ...budget, items };
  }

  function recalculateBudget(id) {
    const items = db.prepare(`SELECT * FROM sales_budget_items WHERE budget_id = ?`).all(id);
    const subtotal = items.reduce((sum, item) => sum + Number(item.original_price || item.unit_price || 0) * Number(item.quantity || 0), 0);
    const discount = items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
    const total = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
    const budget = db.prepare(`SELECT * FROM sales_budgets WHERE id = ?`).get(id);
    const paymentReceived = Number(budget?.payment_received || 0);
    const balance = Math.max(0, total - paymentReceived);

    db.prepare(`
      UPDATE sales_budgets
      SET subtotal = ?, discount_total = ?, total = ?, balance = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(subtotal, discount, total, balance, id);
  }

  function addAudit({ budgetId, user, action, before = null, after = null }) {
    db.prepare(`
      INSERT INTO sales_audit_log (budget_id, user, action, before_json, after_json, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(
      budgetId,
      safeText(user) || "Sistema",
      action,
      before ? JSON.stringify(before) : "",
      after ? JSON.stringify(after) : ""
    );
  }

  function normalizeItem(item) {
    const quantity = Number(item.quantity || 1);
    const originalPrice = Number(item.original_price || item.price || item.unit_price || 0);
    const discountPercent = Number(item.discount_percent || 0);
    const discountManual = Number(item.discount_amount || 0);
    const percentAmount = originalPrice * quantity * (discountPercent / 100);
    const discountAmount = Math.max(0, discountManual + percentAmount);
    const lineTotal = Math.max(0, originalPrice * quantity - discountAmount);
    const finalPrice = quantity > 0 ? lineTotal / quantity : 0;

    return {
      product_id: item.product_id || item.id || null,
      sku: safeText(item.sku),
      product_name: safeText(item.product_name || item.name),
      quantity,
      originalPrice,
      unitPrice: originalPrice,
      discountPercent,
      discountAmount,
      finalPrice,
      lineTotal,
      stock: Number(item.stock_available || item.stock || 0),
    };
  }

  function insertItem(stmt, budgetId, item) {
    const normalized = normalizeItem(item);
    stmt.run(
      budgetId,
      normalized.product_id,
      normalized.sku,
      normalized.product_name,
      normalized.quantity,
      normalized.originalPrice,
      normalized.unitPrice,
      normalized.discountPercent,
      normalized.discountAmount,
      normalized.finalPrice,
      normalized.lineTotal,
      normalized.stock
    );
  }

  app.get("/api/products/search", (req, res) => {
    try {
      const q = safeText(req.query.q);
      if (q.length < 3) return res.json([]);

      const rows = db.prepare(`
        SELECT id, sku, name, category, price, stock, active
        FROM products
        WHERE active = 1
          AND (LOWER(sku) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?))
        ORDER BY name ASC
        LIMIT 20
      `).all(`%${q}%`, `%${q}%`, `%${q}%`);

      res.json(rows);
    } catch (error) {
      console.error("ERROR PRODUCT SEARCH:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sales/budgets", (req, res) => {
    try {
      const { status, assigned_to } = req.query;
      const filters = [];
      const params = [];

      if (status && status !== "Todos") {
        filters.push("status = ?");
        params.push(status);
      }

      if (assigned_to) {
        filters.push("assigned_to = ?");
        params.push(assigned_to);
      }

      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = db.prepare(`SELECT * FROM sales_budgets ${where} ORDER BY id DESC`).all(...params);
      res.json(rows);
    } catch (error) {
      console.error("ERROR SALES BUDGET LIST:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sales/budgets/:id", (req, res) => {
    try {
      const budget = getBudget(req.params.id);
      if (!budget) return res.status(404).json({ error: "Presupuesto no encontrado" });
      const audit = db.prepare(`SELECT * FROM sales_audit_log WHERE budget_id = ? ORDER BY id DESC`).all(req.params.id);
      res.json({ ...budget, audit });
    } catch (error) {
      console.error("ERROR SALES BUDGET DETAIL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sales/budgets", (req, res) => {
    try {
      const data = req.body || {};
      const items = Array.isArray(data.items) ? data.items : [];

      const result = db.prepare(`
        INSERT INTO sales_budgets (
          client, contact_name, phone, email, seller, assigned_to, status,
          payment_method, payment_received, subtotal, discount_total, total, balance,
          notes, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, datetime('now'), datetime('now'))
      `).run(
        safeText(data.client) || "Cliente mostrador",
        safeText(data.contact_name),
        safeText(data.phone),
        safeText(data.email),
        safeText(data.seller || data.created_by),
        safeText(data.assigned_to || data.seller || data.created_by),
        "Pendiente",
        safeText(data.payment_method) || "Efectivo",
        Number(data.payment_received || 0),
        safeText(data.notes),
        safeText(data.created_by) || "Sistema"
      );

      const budgetId = result.lastInsertRowid;
      const insertStmt = db.prepare(`
        INSERT INTO sales_budget_items (
          budget_id, product_id, sku, product_name, quantity, original_price,
          unit_price, discount_percent, discount_amount, final_price, line_total,
          stock_available, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      items.forEach((item) => insertItem(insertStmt, budgetId, item));
      recalculateBudget(budgetId);
      const budget = getBudget(budgetId);
      addAudit({ budgetId, user: data.created_by, action: "Presupuesto creado", after: budget });
      res.json(budget);
    } catch (error) {
      console.error("ERROR SALES BUDGET CREATE:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/sales/budgets/:id", (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body || {};
      const before = getBudget(id);
      if (!before) return res.status(404).json({ error: "Presupuesto no encontrado" });
      if (!["Pendiente", "Aprobado"].includes(before.status)) return res.status(400).json({ error: "Solo se pueden editar presupuestos pendientes o aprobados" });

      db.prepare(`
        UPDATE sales_budgets
        SET client = ?, contact_name = ?, phone = ?, email = ?, payment_method = ?, payment_received = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        safeText(data.client || before.client),
        safeText(data.contact_name || before.contact_name),
        safeText(data.phone || before.phone),
        safeText(data.email || before.email),
        safeText(data.payment_method || before.payment_method),
        Number(data.payment_received ?? before.payment_received ?? 0),
        safeText(data.notes || before.notes),
        id
      );

      if (Array.isArray(data.items)) {
        db.prepare(`DELETE FROM sales_budget_items WHERE budget_id = ?`).run(id);
        const insertStmt = db.prepare(`
          INSERT INTO sales_budget_items (
            budget_id, product_id, sku, product_name, quantity, original_price,
            unit_price, discount_percent, discount_amount, final_price, line_total,
            stock_available, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        data.items.forEach((item) => insertItem(insertStmt, id, item));
      }

      recalculateBudget(id);
      const after = getBudget(id);
      addAudit({ budgetId: id, user: data.user, action: "Presupuesto editado", before, after });
      res.json(after);
    } catch (error) {
      console.error("ERROR SALES BUDGET UPDATE:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/sales/budgets/:id/cancel", (req, res) => {
    try {
      const { id } = req.params;
      const { user = "Sistema" } = req.body || {};
      const before = getBudget(id);
      if (!before) return res.status(404).json({ error: "Presupuesto no encontrado" });
      db.prepare(`UPDATE sales_budgets SET status = 'Cancelado', updated_at = datetime('now') WHERE id = ?`).run(id);
      const after = getBudget(id);
      addAudit({ budgetId: id, user, action: "Presupuesto cancelado", before, after });
      res.json(after);
    } catch (error) {
      console.error("ERROR SALES BUDGET CANCEL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/sales/budgets/:id/convert", (req, res) => {
    try {
      const { id } = req.params;
      const { user = "Sistema" } = req.body || {};
      const budget = getBudget(id);
      if (!budget) return res.status(404).json({ error: "Presupuesto no encontrado" });
      if (budget.status === "Convertido") return res.status(400).json({ error: "El presupuesto ya fue convertido" });
      if (budget.status === "Cancelado") return res.status(400).json({ error: "El presupuesto está cancelado" });

      for (const item of budget.items || []) {
        const product = item.product_id ? db.prepare(`SELECT * FROM products WHERE id = ?`).get(item.product_id) : null;
        if (product && Number(product.stock || 0) < Number(item.quantity || 0)) {
          return res.status(400).json({ error: `Stock insuficiente para ${item.product_name}. Disponible: ${product.stock}. Solicitado: ${item.quantity}.` });
        }
      }

      for (const item of budget.items || []) {
        if (!item.product_id) continue;
        db.prepare(`UPDATE products SET stock = MAX(0, stock - ?), updated_at = datetime('now') WHERE id = ?`).run(Number(item.quantity || 0), item.product_id);
      }

      const saleNumber = `VENTA-${Date.now()}`;
      db.prepare(`UPDATE sales_budgets SET status = 'Convertido', sale_number = ?, converted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(saleNumber, id);
      const after = getBudget(id);
      addAudit({ budgetId: id, user, action: `Convertido a venta ${saleNumber}`, before: budget, after });

      if (after.assigned_to && createNotification) {
        createNotification({ userName: after.assigned_to, requestId: after.id, title: "Presupuesto convertido a venta", message: `El presupuesto #${after.id} fue convertido a venta ${saleNumber}.` });
      }

      res.json(after);
    } catch (error) {
      console.error("ERROR SALES BUDGET CONVERT:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notifications/check-sales-alerts", (req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM sales_budgets WHERE status = 'Pendiente' AND date(created_at) <= date('now', '-2 day')`).all();
      let created = 0;

      for (const budget of rows) {
        const userName = budget.assigned_to || budget.seller || "";
        if (!userName) continue;
        const existing = db.prepare(`SELECT * FROM notifications WHERE requestId = ? AND title = ? AND userName = ?`).get(budget.id, "Presupuesto pendiente", userName);
        if (existing) continue;
        const title = "Presupuesto pendiente";
        const message = `El presupuesto #${budget.id} de ${budget.client} sigue pendiente. Revisar si debe convertirse a venta o cancelarse.`;
        createNotification({ userName, requestId: budget.id, title, message });
        created += 1;
        if (emailUserByName && fireAndForget) fireAndForget(emailUserByName(userName, title, message, budget.id), "Error email presupuesto pendiente:");
      }

      res.json({ created });
    } catch (error) {
      console.error("ERROR CHECK SALES ALERTS:", error);
      res.status(500).json({ error: error.message });
    }
  });
};
