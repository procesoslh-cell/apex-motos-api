module.exports = function registerRoutes(context) {
  const { app, db, axios, queryOdoo, sendEmail, fireAndForget, emailTemplate, publicUser, getUserByName, getUsersByRole, emailUsersByRole, emailUserByName, emailCustomer, createNotification, addHistory, getRequestById, upload, uploadCollection, uploadsDir, mailEnabled } = context;

app.get("/api/collections", (req, res) => {
  try {
    const { asesorId } = req.query;

    let rows = [];

    if (asesorId) {
      rows = db.prepare(`
        SELECT *
        FROM collections
        WHERE asesor_id = ?
        ORDER BY id DESC
      `).all(asesorId);
    } else {
      rows = db.prepare(`
        SELECT *
        FROM collections
        ORDER BY id DESC
      `).all();
    }

    res.json(rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});
app.get("/api/collections/:id", (req, res) => {
  try {
    const { id } = req.params;

    const collection = db.prepare(`
      SELECT *
      FROM collections
      WHERE id = ?
    `).get(id);

    if (!collection) {
      return res.status(404).json({
        error: "Cobranza no encontrada",
      });
    }

    const items = db.prepare(`
      SELECT *
      FROM collection_items
      WHERE collection_id = ?
    `).all(id);

    const files = db.prepare(`
      SELECT *
      FROM collection_files
      WHERE collection_id = ?
      ORDER BY id DESC
    `).all(id);

    res.json({
      ...collection,
      items,
      files,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});
app.post("/api/collections", (req, res) => {
  try {
    const {
      cliente_id,
      cliente,
      asesor_id,
      asesor,
      total,
      payment_method,
      notes,
      items,
    } = req.body;

    const receiptNumber = "RC-" + Date.now();

    const result = db.prepare(`
      INSERT INTO collections (
        cliente_id,
        cliente,
        asesor_id,
        asesor,
        total,
        payment_method,
        status,
        notes,
        receipt_number,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      cliente_id,
      cliente,
      asesor_id,
      asesor,
      total,
      payment_method,
      "Pendiente validación",
      notes || "",
      receiptNumber
    );

    const collectionId = result.lastInsertRowid;

    if (items?.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO collection_items (
          collection_id,
          invoice_id,
          invoice_number,
          amount
        )
        VALUES (?, ?, ?, ?)
      `);

      items.forEach((item) => {
        stmt.run(
          collectionId,
          item.invoice_id,
          item.invoice_number,
          item.amount
        );
      });
    }

    createNotification({
      userRole: "cuentas",
      requestId: collectionId,
      title: "Nueva cobranza registrada",
      message: `${asesor} registró una cobranza de $${Number(
        total || 0
      ).toLocaleString("es-AR")} para ${cliente}.`,
    });

    fireAndForget(
      emailUsersByRole(
        "cuentas",
        "Nueva cobranza registrada",
        `${asesor} registró una cobranza para ${cliente}.`,
        collectionId
      ),
      "Error email cobranza:"
    );

    res.json({
      success: true,
      collectionId,
      receiptNumber,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.patch("/api/collections/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const {
  status,
  user,
  observation_reason,
} = req.body;

    db.prepare(`
  UPDATE collections
  SET
    status = ?,
    validated_at = datetime('now'),
    validated_by = ?,
    observation_reason = ?
  WHERE id = ?
`).run(
  status,
  user,
  observation_reason || null,
  id
);

    const collection = db.prepare(`
      SELECT *
      FROM collections
      WHERE id = ?
    `).get(id);

    createNotification({
      userRole: "vendedor",
      requestId: Number(id),
      title: "Actualización de cobranza",
      message: `La cobranza ${collection.receipt_number} fue ${status.toLowerCase()}.`,
    });

    res.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});
app.patch("/api/collections/:id/resubmit", (req, res) => {
  try {
    const { id } = req.params;

    const {
      payment_method,
      notes,
    } = req.body;

    db.prepare(`
      UPDATE collections
      SET
        payment_method = ?,
        notes = ?,
        status = 'Pendiente validación',
        observation_reason = NULL
      WHERE id = ?
    `).run(
      payment_method,
      notes,
      id
    );

    const collection = db.prepare(`
      SELECT *
      FROM collections
      WHERE id = ?
    `).get(id);

    createNotification({
      userRole: "cuentas",
      requestId: Number(id),
      title: "Cobranza reenviada",
      message: `${collection.asesor} reenviò la cobranza ${collection.receipt_number}.`,
    });

    res.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});
app.post(
  "/api/collections/:id/upload",
  uploadCollection.single("file"),
  (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          error: "Archivo requerido",
        });
      }

      db.prepare(`
        INSERT INTO collection_files (
          collection_id,
          filename,
          original_name,
          uploaded_at
        )
        VALUES (?, ?, ?, datetime('now'))
      `).run(
        id,
        req.file.filename,
        req.file.originalname
      );

      res.json({
        success: true,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: error.message,
      });
    }
  }
);
/* =========================
   ODOO CLIENTES / FACTURAS / PRESUPUESTOS
========================= */

};
