module.exports = function registerRoutes(context) {
  const { app, db } = context;

  /* =========================
     CRM - OPORTUNIDADES
  ========================= */

  app.get("/api/crm/opportunities", (req, res) => {
    try {
      const { role, name } = req.query;

      let rows;

      if (role === "vendedor" || role === "gestor") {
        rows = db
          .prepare(`
            SELECT *
            FROM crm_opportunities
            WHERE assigned_to = ?
               OR owner = ?
            ORDER BY id DESC
          `)
          .all(name || "", name || "");
      } else {
        rows = db
          .prepare(`
            SELECT *
            FROM crm_opportunities
            ORDER BY id DESC
          `)
          .all();
      }

      res.json(rows);
    } catch (error) {
      console.error("ERROR CRM LIST:", error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  app.post("/api/crm/opportunities", (req, res) => {
    try {
      const data = req.body;

      const result = db
        .prepare(`
          INSERT INTO crm_opportunities (
            title,
            client,
            contact_name,
            phone,
            email,
            segment,
            source,
            type,
            stage,
            status,
            owner,
            owner_role,
            assigned_to,
            priority,
            expected_amount,
            notes,
            created_at,
            updated_at,
            next_action_date,
            next_action,
            sla_status,
            last_activity_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            datetime('now'), datetime('now'), ?, ?, ?, datetime('now')
          )
        `)
        .run(
          data.title || "",
          data.client || "",
          data.contact_name || "",
          data.phone || "",
          data.email || "",
          data.segment || "",
          data.source || "Manual",
          data.type || "Lead",
          data.stage || "Prospecto",
          data.status || "Abierta",
          data.owner || "",
          data.owner_role || "",
          data.assigned_to || data.owner || "",
          data.priority || "Media",
          Number(data.expected_amount || 0),
          data.notes || "",
          data.next_action_date || null,
          data.next_action || "",
          data.sla_status || "ok"
        );

      const created = db
        .prepare(`
          SELECT *
          FROM crm_opportunities
          WHERE id = ?
        `)
        .get(result.lastInsertRowid);

      res.json(created);
    } catch (error) {
      console.error("ERROR CRM CREATE:", error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  app.get("/api/crm/opportunities/:id", (req, res) => {
    try {
      const { id } = req.params;

      const opportunity = db
        .prepare(`
          SELECT *
          FROM crm_opportunities
          WHERE id = ?
        `)
        .get(id);

      if (!opportunity) {
        return res.status(404).json({
          error: "Oportunidad no encontrada",
        });
      }

      const activities = db
        .prepare(`
          SELECT *
          FROM crm_activities
          WHERE opportunity_id = ?
          ORDER BY id DESC
        `)
        .all(id);

      const history = db
        .prepare(`
          SELECT *
          FROM crm_stage_history
          WHERE opportunity_id = ?
          ORDER BY id DESC
        `)
        .all(id);

      const erpSync = db
        .prepare(`
          SELECT *
          FROM crm_erp_sync
          WHERE opportunity_id = ?
          ORDER BY id DESC
        `)
        .all(id);

      res.json({
        ...opportunity,
        activities,
        history,
        erpSync,
      });
    } catch (error) {
      console.error("ERROR CRM DETAIL:", error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  app.patch("/api/crm/opportunities/:id/stage", (req, res) => {
    try {
      const { id } = req.params;
      const { stage, user } = req.body;

      const current = db
        .prepare(`
          SELECT *
          FROM crm_opportunities
          WHERE id = ?
        `)
        .get(id);

      if (!current) {
        return res.status(404).json({
          error: "Oportunidad no encontrada",
        });
      }

      db.prepare(`
        UPDATE crm_opportunities
        SET
          stage = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(stage, id);

      db.prepare(`
        INSERT INTO crm_stage_history (
          opportunity_id,
          from_stage,
          to_stage,
          user,
          created_at
        )
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(
        id,
        current.stage,
        stage,
        user || "Sistema"
      );

      const updated = db
        .prepare(`
          SELECT *
          FROM crm_opportunities
          WHERE id = ?
        `)
        .get(id);

      res.json(updated);
    } catch (error) {
      console.error("ERROR CRM STAGE:", error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  app.post("/api/crm/opportunities/:id/activities", (req, res) => {
    try {
      const { id } = req.params;
      const { type, result, comment, user } = req.body;

      const opportunity = db
        .prepare(`
          SELECT *
          FROM crm_opportunities
          WHERE id = ?
        `)
        .get(id);

      if (!opportunity) {
        return res.status(404).json({
          error: "Oportunidad no encontrada",
        });
      }

      const activityResult = db
        .prepare(`
          INSERT INTO crm_activities (
            opportunity_id,
            type,
            result,
            comment,
            user,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `)
        .run(
          id,
          type || "Nota",
          result || "",
          comment || "",
          user || "Usuario"
        );

      db.prepare(`
        UPDATE crm_opportunities
        SET
          updated_at = datetime('now'),
          last_activity_at = datetime('now')
        WHERE id = ?
      `).run(id);

      const activity = db
        .prepare(`
          SELECT *
          FROM crm_activities
          WHERE id = ?
        `)
        .get(activityResult.lastInsertRowid);

      res.json(activity);
    } catch (error) {
      console.error("ERROR CRM ACTIVITY:", error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  /* =========================
     CRM - ERP MOCK
  ========================= */

  app.post("/api/crm/opportunities/:id/generate-quote", (req, res) => {
    try {
      const { id } = req.params;
      const { erpType = "Odoo", user = "Sistema" } = req.body;

      const opportunity = db
        .prepare(`
          SELECT *
          FROM crm_opportunities
          WHERE id = ?
        `)
        .get(id);

      if (!opportunity) {
        return res.status(404).json({
          error: "Oportunidad no encontrada",
        });
      }

      const erpDocumentId = String(Date.now());
      const quoteNumber = `${erpType.toUpperCase()}-PRES-${erpDocumentId}`;

      const payload = {
        opportunityId: opportunity.id,
        client: opportunity.client,
        contact: opportunity.contact_name,
        expectedAmount: opportunity.expected_amount,
        source: "SGI CRM",
        generatedBy: user,
      };

      db.prepare(`
        INSERT INTO crm_erp_sync (
          opportunity_id,
          erp_type,
          erp_document_type,
          erp_document_id,
          erp_document_number,
          sync_status,
          payload,
          error_message,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id,
        erpType,
        "Presupuesto",
        erpDocumentId,
        quoteNumber,
        "Sincronizado mock",
        JSON.stringify(payload),
        ""
      );

      db.prepare(`
        UPDATE crm_opportunities
        SET
          erp_status = ?,
          erp_quote_number = ?,
          erp_quote_id = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        "Presupuesto generado",
        quoteNumber,
        erpDocumentId,
        id
      );

      db.prepare(`
        INSERT INTO crm_activities (
          opportunity_id,
          type,
          result,
          comment,
          user,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(
        id,
        "ERP",
        "Presupuesto generado",
        `Se generó presupuesto mock en ${erpType}: ${quoteNumber}`,
        user
      );

      const updated = db
        .prepare(`
          SELECT *
          FROM crm_opportunities
          WHERE id = ?
        `)
        .get(id);

      res.json({
        success: true,
        opportunity: updated,
        quoteNumber,
      });
    } catch (error) {
      console.error("ERROR GENERATE QUOTE:", error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  /* =========================
     CRM - ALERTAS Y AUTOMATIZACIONES
  ========================= */

  app.post("/api/crm/automations/run", (req, res) => {
    try {
      db.prepare(`
        UPDATE crm_alerts
        SET status = 'Resuelta', resolved_at = datetime('now')
        WHERE status = 'Abierta'
      `).run();

      const opportunities = db.prepare(`
        SELECT *
        FROM crm_opportunities
        WHERE status IS NULL
           OR status NOT IN ('Ganada', 'Perdida', 'Cerrada')
      `).all();

      const insertAlert = db.prepare(`
        INSERT INTO crm_alerts (
          opportunity_id, type, severity, title, message, assigned_to, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'Abierta', datetime('now'))
      `);

      let created = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const opportunity of opportunities) {
        if (opportunity.next_action_date) {
          const due = new Date(opportunity.next_action_date);
          due.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);

          if (diffDays < 0) {
            insertAlert.run(
              opportunity.id,
              'SLA_VENCIDO',
              'Alta',
              'Acción vencida',
              `${opportunity.client || opportunity.title || 'Oportunidad'} tiene una acción vencida desde ${opportunity.next_action_date}.`,
              opportunity.assigned_to || opportunity.owner || ''
            );
            created += 1;
          } else if (diffDays <= 1) {
            insertAlert.run(
              opportunity.id,
              'SLA_POR_VENCER',
              'Media',
              'Acción por vencer',
              `${opportunity.client || opportunity.title || 'Oportunidad'} requiere seguimiento pronto.`,
              opportunity.assigned_to || opportunity.owner || ''
            );
            created += 1;
          }
        }

        if (opportunity.updated_at) {
          const updated = new Date(opportunity.updated_at);
          const ageDays = Math.floor((Date.now() - updated.getTime()) / 86400000);
          if (ageDays >= 7) {
            insertAlert.run(
              opportunity.id,
              'SIN_ACTIVIDAD',
              'Media',
              'Oportunidad sin actividad',
              `${opportunity.client || opportunity.title || 'Oportunidad'} no registra movimientos hace ${ageDays} días.`,
              opportunity.assigned_to || opportunity.owner || ''
            );
            created += 1;
          }
        }
      }

      res.json({ success: true, created });
    } catch (error) {
      console.error('ERROR CRM AUTOMATIONS:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/crm/alerts", (req, res) => {
    try {
      const { role, name } = req.query;
      let rows;

      if (role === 'vendedor') {
        rows = db.prepare(`
          SELECT a.*, o.client, o.stage
          FROM crm_alerts a
          LEFT JOIN crm_opportunities o ON o.id = a.opportunity_id
          WHERE a.status = 'Abierta'
            AND a.assigned_to = ?
          ORDER BY a.id DESC
        `).all(name || '');
      } else {
        rows = db.prepare(`
          SELECT a.*, o.client, o.stage
          FROM crm_alerts a
          LEFT JOIN crm_opportunities o ON o.id = a.opportunity_id
          WHERE a.status = 'Abierta'
          ORDER BY a.id DESC
        `).all();
      }

      res.json(rows);
    } catch (error) {
      console.error('ERROR CRM ALERTS:', error);
      res.status(500).json({ error: error.message });
    }
  });

};
