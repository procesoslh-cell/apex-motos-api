module.exports = function registerRoutes(context) {
  const { app, db, axios, queryOdoo, sendEmail, fireAndForget, emailTemplate, publicUser, getUserByName, getUsersByRole, emailUsersByRole, emailUserByName, emailCustomer, createNotification, addHistory, getRequestById, upload, uploadCollection, uploadsDir, mailEnabled } = context;

app.get("/api/requests", (req, res) => {
  const rows = db
    .prepare(`
      SELECT *
      FROM requests
      ORDER BY id DESC
    `)
    .all();

  const result = rows.map((row) => getRequestById(row.id));

  res.json(result);
});

app.post("/api/requests", (req, res) => {
  try {
    const data = req.body;
    const createdAt = new Date().toISOString();

    const needsSupervisorApproval =
      data.type === "Nota de crédito";

    const initialArea = needsSupervisorApproval
      ? "Supervisor"
      : data.area || "Cuentas Corrientes";

    const initialStatus = needsSupervisorApproval
      ? "Pendiente aprobación supervisor"
      : "Nueva";

    const notifyRole = needsSupervisorApproval
      ? "supervisor"
      : "cuentas";

    const result = db
      .prepare(`
        INSERT INTO requests (
          type,
          client,
          requester,
          area,
          priority,
          status,
          dueDate,
          createdAt,
          fantasyName,
          businessName,
          cuit,
          email,
          mobile,
          storeAddress,
          deliveryAddress,
          postalCodeCity,
          description
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      .run(
        data.type || "Alta de cliente",
        data.client || "",
        data.requester || "Comercial",
        initialArea,
        data.priority || "Alta",
        initialStatus,
        data.dueDate || "",
        createdAt,
        data.fantasyName || "",
        data.businessName || "",
        data.cuit || "",
        data.email || "",
        data.mobile || "",
        data.storeAddress || "",
        data.deliveryAddress || "",
        data.postalCodeCity || "",
        data.description || ""
      );

    const requestId = result.lastInsertRowid;

    addHistory(
      requestId,
      data.requester,
      needsSupervisorApproval
        ? "Creó la solicitud y quedó pendiente de aprobación del supervisor"
        : "Creó la solicitud"
    );

    const title = needsSupervisorApproval
      ? "Nota de crédito pendiente de aprobación"
      : "Nueva solicitud creada";

    const message = `${data.requester || "Comercial"} creó una solicitud de ${
      data.type || "Alta de cliente"
    } para ${data.client || "cliente sin nombre"}.`;

    createNotification({
      userRole: notifyRole,
      requestId,
      title,
      message,
    });

    const createdRequest = getRequestById(requestId);

    res.json(createdRequest);

    fireAndForget(
      emailUsersByRole(
        notifyRole,
        title,
        message,
        requestId
      ),
      "Error email nueva solicitud:"
    );
  } catch (error) {
    console.error("Error creando solicitud:", error);

    res.status(500).json({
      error: "Error creando solicitud",
    });
  }
});

app.patch("/api/requests/:id/status", (req, res) => {
  try {
    const id = req.params.id;
    const { status, user } = req.body;

    const current = db
      .prepare(`SELECT * FROM requests WHERE id = ?`)
      .get(id);

    if (!current) {
      return res.status(404).json({
        error: "Solicitud no encontrada",
      });
    }

    db.prepare(`
      UPDATE requests
      SET status = ?
      WHERE id = ?
    `).run(status, id);

    addHistory(id, user, `Cambió estado de "${current.status}" a "${status}"`);

    const title = `Estado actualizado: ${status}`;
    const message = `${user || "Cuentas Corrientes"} cambió la solicitud #${id} de "${
      current.status
    }" a "${status}".`;

    createNotification({
      userName: current.requester,
      requestId: Number(id),
      title,
      message,
    });

    const updatedRequest = getRequestById(id);
    if (current.type === "Alta de cliente") {
  if (status === "Faltan datos") {
    fireAndForget(
      emailCustomer({
        request: current,
        subject: "Necesitamos documentación para continuar tu alta",
        message: `Hola ${current.client || ""}, para continuar con tu alta como cliente necesitamos documentación o información adicional. Tu asesor fue notificado para acompañarte en el proceso.`,
      }),
      "Error email cliente faltan datos:"
    );
  }

  if (status === "Finalizada") {
    fireAndForget(
      emailCustomer({
        request: current,
        subject: "Tu alta como cliente fue aprobada",
        message: `Hola ${current.client || ""}, tu alta como cliente fue aprobada correctamente. Ya podés operar con López Hnos.`,
      }),
      "Error email cliente alta aprobada:"
    );
  }
}

    res.json(updatedRequest);

    fireAndForget(
      emailUserByName(current.requester, title, message, Number(id)),
      "Error email cambio estado:"
    );
  } catch (error) {
    console.error("Error actualizando estado:", error);
    res.status(500).json({
      error: "Error actualizando estado",
    });
  }
});

app.post("/api/requests/:id/comments", (req, res) => {
  try {
    const id = req.params.id;
    const { author, comment } = req.body;

    const request = db
      .prepare(`SELECT * FROM requests WHERE id = ?`)
      .get(id);

    if (!request) {
      return res.status(404).json({
        error: "Solicitud no encontrada",
      });
    }

    db.prepare(`
      INSERT INTO comments (
        requestId,
        author,
        comment,
        createdAt
      )
      VALUES (?, ?, ?, ?)
    `).run(id, author || "Usuario", comment || "", new Date().toLocaleString());

    addHistory(id, author, "Agregó comentario");

    const updatedRequest = getRequestById(id);

    res.json(updatedRequest);

    if (author === request.requester) {
      const title = "Comentario del vendedor";
      const message = `${author} comentó la solicitud #${id}.`;

      createNotification({
        userRole: "cuentas",
        requestId: Number(id),
        title,
        message,
      });

      fireAndForget(
        emailUsersByRole("cuentas", title, message, Number(id)),
        "Error email comentario vendedor:"
      );
    } else {
      const title = "Nuevo comentario";
      const message = `${author || "Usuario"} comentó la solicitud #${id}.`;

      createNotification({
        userName: request.requester,
        requestId: Number(id),
        title,
        message,
      });

      fireAndForget(
        emailUserByName(request.requester, title, message, Number(id)),
        "Error email comentario:"
      );
    }
  } catch (error) {
    console.error("Error agregando comentario:", error);
    res.status(500).json({
      error: "Error agregando comentario",
    });
  }
});
/* =========================
   CRM ERP MOCK
========================= */

app.post("/api/requests/:id/files", upload.single("file"), (req, res) => {
  try {
    const id = req.params.id;
    const { category, user } = req.body;

    const request = db
      .prepare(`SELECT * FROM requests WHERE id = ?`)
      .get(id);

    if (!request) {
      return res.status(404).json({
        error: "Solicitud no encontrada",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Archivo no recibido",
      });
    }

    const fileUrl = `${PUBLIC_API_URL}/uploads/${req.file.filename}`;
    const uploadedAt = new Date().toLocaleString();

    const result = db
      .prepare(`
        INSERT INTO request_files (
          requestId,
          category,
          originalName,
          filename,
          url,
          uploadedAt
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        category || "Archivo",
        req.file.originalname,
        req.file.filename,
        fileUrl,
        uploadedAt
      );

    addHistory(id, user, `Adjuntó archivo: ${category || "Archivo"}`);

    res.json({
      id: result.lastInsertRowid,
      requestId: Number(id),
      category: category || "Archivo",
      originalName: req.file.originalname,
      filename: req.file.filename,
      url: fileUrl,
      uploadedAt,
    });

    if ((user || "") === request.requester) {
      const title = "Documentación adjunta";
      const message = `${user} adjuntó "${category || "Archivo"}" en la solicitud #${id}.`;

      createNotification({
        userRole: "cuentas",
        requestId: Number(id),
        title,
        message,
      });

      fireAndForget(
        emailUsersByRole("cuentas", title, message, Number(id)),
        "Error email archivo vendedor:"
      );
    } else {
      const title = "Archivo adjunto";
      const message = `${user || "Usuario"} adjuntó "${category || "Archivo"}" en la solicitud #${id}.`;

      createNotification({
        userName: request.requester,
        requestId: Number(id),
        title,
        message,
      });

      fireAndForget(
        emailUserByName(request.requester, title, message, Number(id)),
        "Error email archivo:"
      );
    }
  } catch (error) {
    console.error("Error subiendo archivo:", error);
    res.status(500).json({
      error: "Error subiendo archivo",
    });
  }
});

/* =========================
   NOTIFICATIONS
========================= */

};
