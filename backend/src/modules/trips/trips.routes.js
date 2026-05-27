module.exports = function registerRoutes(context) {
  const {
    app,
    db,
    createNotification,
    emailUserByName,
    fireAndForget,
  } = context;

  function safeText(value) {
    return String(value || "").trim();
  }

  function notifyUser(userName, title, message, requestId = null) {
    if (!userName) return;

    try {
      if (createNotification) {
        createNotification({
          userName,
          requestId,
          title,
          message,
        });
      }
    } catch (error) {
      console.error("ERROR NOTIFICANDO GIRA:", error);
    }

    try {
      if (emailUserByName && fireAndForget) {
        fireAndForget(
          emailUserByName(userName, title, message)
        );
      }
    } catch (error) {
      console.error("ERROR EMAIL GIRA:", error);
    }
  }

  app.post("/api/trips", (req, res) => {
    try {
      const {
        asesor_id,
        asesor,
        nombre,
        mes,
        observaciones,
        start_date,
        end_date,
        clientes,
      } = req.body;

      if (!asesor_id || !asesor || !nombre || !mes || !start_date || !end_date) {
        return res.status(400).json({
          error: "Faltan datos obligatorios de la gira.",
        });
      }

      const tripResult = db.prepare(`
        INSERT INTO trips (
          asesor_id,
          asesor,
          nombre,
          mes,
          observaciones,
          start_date,
          end_date,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        asesor_id,
        asesor,
        safeText(nombre),
        safeText(mes),
        safeText(observaciones),
        start_date,
        end_date,
        "Planificada"
      );

      const tripId = tripResult.lastInsertRowid;

      if (Array.isArray(clientes) && clientes.length > 0) {
        const stmt = db.prepare(`
          INSERT INTO trip_clients (
            trip_id,
            cliente_id,
            cliente,
            estado,
            partner_latitude,
            partner_longitude
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        clientes.forEach((cliente) => {
          stmt.run(
            tripId,
            cliente.cliente_id,
            cliente.cliente,
            cliente.estado,
            cliente.partner_latitude || null,
            cliente.partner_longitude || null
          );
        });
      }

      notifyUser(
        asesor,
        "Nueva gira asignada",
        `Se creó la gira ${nombre}. Inicio: ${start_date}. Fin: ${end_date}.`,
        tripId
      );

      res.json({
        success: true,
        tripId,
      });
    } catch (error) {
      console.error("ERROR CREANDO GIRA:", error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  app.get("/api/trips", (req, res) => {
    try {
      const { role, odooUserId } = req.query;

      let rows;

      if (role === "vendedor" && odooUserId) {
        rows = db
          .prepare(`
            SELECT *
            FROM trips
            WHERE asesor_id = ?
            ORDER BY id DESC
          `)
          .all(Number(odooUserId));
      } else {
        rows = db
          .prepare(`
            SELECT *
            FROM trips
            ORDER BY id DESC
          `)
          .all();
      }

      res.json(rows);
    } catch (error) {
      console.error("ERROR LISTANDO GIRAS:", error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  app.get("/api/trips/:id", (req, res) => {
    try {
      const tripId = req.params.id;

      const trip = db.prepare(`
        SELECT *
        FROM trips
        WHERE id = ?
      `).get(tripId);

      if (!trip) {
        return res.status(404).json({
          error: "Gira no encontrada",
        });
      }

      const clients = db.prepare(`
        SELECT *
        FROM trip_clients
        WHERE trip_id = ?
        ORDER BY cliente
      `).all(tripId);

      res.json({
        trip,
        clients,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  app.post("/api/trips/visit", (req, res) => {
    try {
      const {
        trip_id,
        cliente_id,
        comentario,
        lat,
        lng,
      } = req.body;

      db.prepare(`
        UPDATE trip_clients
        SET
          visit_status = 'Visitado',
          visit_comment = ?,
          visited_at = datetime('now'),
          visited_lat = ?,
          visited_lng = ?
        WHERE trip_id = ?
        AND cliente_id = ?
      `).run(
        safeText(comentario),
        lat,
        lng,
        trip_id,
        cliente_id
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
  });

  app.post("/api/trips/close", (req, res) => {
    try {
      const {
        trip_id,
        pedidos,
        monto,
        observaciones,
        user,
      } = req.body;

      const trip = db.prepare(`
        SELECT *
        FROM trips
        WHERE id = ?
      `).get(trip_id);

      if (!trip) {
        return res.status(404).json({
          error: "Gira no encontrada",
        });
      }

      db.prepare(`
        UPDATE trips
        SET
          status = 'Pendiente revisión',
          result_orders_count = ?,
          result_estimated_amount = ?,
          result_notes = ?,
          closed_at = datetime('now')
        WHERE id = ?
      `).run(
        Number(pedidos || 0),
        Number(monto || 0),
        safeText(observaciones),
        trip_id
      );

      const supervisors = db.prepare(`
        SELECT name
        FROM users
        WHERE active = 1
          AND role IN ('admin', 'supervisor', 'gerente', 'jefe')
      `).all();

      supervisors.forEach((supervisor) => {
        notifyUser(
          supervisor.name,
          "Gira pendiente de revisión",
          `${trip.asesor} cerró la gira ${trip.nombre}. Revisá resultados y devolución.`,
          trip_id
        );
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

  app.post("/api/trips/:id/review", (req, res) => {
    try {
      const { id } = req.params;
      const {
        supervisor_status,
        supervisor_comments,
        supervisor,
      } = req.body;

      const trip = db.prepare(`
        SELECT *
        FROM trips
        WHERE id = ?
      `).get(id);

      if (!trip) {
        return res.status(404).json({
          error: "Gira no encontrada",
        });
      }

      const finalStatus =
        supervisor_status === "Aprobada" ? "Cerrada" : "Pendiente corrección";

      db.prepare(`
        UPDATE trips
        SET
          status = ?,
          supervisor_status = ?,
          supervisor_comments = ?,
          supervisor_reviewed_by = ?,
          supervisor_reviewed_at = datetime('now')
        WHERE id = ?
      `).run(
        finalStatus,
        safeText(supervisor_status) || "Aprobada",
        safeText(supervisor_comments),
        safeText(supervisor),
        id
      );

      notifyUser(
        trip.asesor,
        "Revisión de gira",
        `${supervisor || "Supervisor"} revisó la gira ${trip.nombre}: ${supervisor_status}.`,
        id
      );

      res.json({
        success: true,
      });
    } catch (error) {
      console.error("ERROR REVIEW TRIP:", error);

      res.status(500).json({
        error: error.message,
      });
    }
  });
};
