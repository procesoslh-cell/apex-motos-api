module.exports = function registerRoutes(context) {
  const { app, db, axios, queryOdoo, sendEmail, fireAndForget, emailTemplate, publicUser, getUserByName, getUsersByRole, emailUsersByRole, emailUserByName, emailCustomer, createNotification, addHistory, getRequestById, upload, uploadCollection, uploadsDir, mailEnabled } = context;

app.get("/api/odoo/health", async (req, res) => {
  try {
    const result = await odooPool.query("SELECT NOW()");

    res.json({
      ok: true,
      result: result.rows[0],
    });
  } catch (error) {
    console.error("ODOO HEALTH ERROR:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

/* =========================
   ODOO ASESORES
========================= */

app.get("/api/odoo/asesores", async (req, res) => {
  try {
    const rows = await queryOdoo(`
      SELECT DISTINCT
        asesor_user.id AS asesor_id,
        asesor_partner.name AS asesor
      FROM res_partner cliente
      LEFT JOIN res_users asesor_user
        ON asesor_user.id = cliente.user_id
      LEFT JOIN res_partner asesor_partner
        ON asesor_partner.id = asesor_user.partner_id
      WHERE cliente.active = true
        AND cliente.customer_rank > 0
        AND asesor_user.id IS NOT NULL
        AND asesor_partner.name IS NOT NULL
      ORDER BY asesor_partner.name
    `);

    res.json(rows);
  } catch (error) {
    console.error("ERROR ASESORES:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

/* =========================
   RADIOGRAFIA COMERCIAL
========================= */

app.get("/api/comercial/radiografia", async (req, res) => {
  try {
    const { asesorId, role, odooUserId } = req.query;

    const params = [];
    let asesorFilter = "";

    if (role === "vendedor" && odooUserId) {
  params.push(Number(odooUserId));
  asesorFilter = `AND asesor_user.id = $${params.length}`;
} else if (asesorId) {
  params.push(Number(asesorId));
  asesorFilter = `AND asesor_user.id = $${params.length}`;
}

    const rows = await queryOdoo(
      `
      SELECT
          cliente.id AS cliente_id,
          cliente.name AS cliente,
          cliente.partner_latitude,
          cliente.partner_longitude,

          asesor_user.id AS asesor_id,
          asesor_partner.name AS asesor,

          DATE_TRUNC('month', am.invoice_date)::date AS mes,
          COUNT(am.id) AS cantidad_facturas

      FROM res_partner cliente

      LEFT JOIN res_users asesor_user
          ON asesor_user.id = cliente.user_id

      LEFT JOIN res_partner asesor_partner
          ON asesor_partner.id = asesor_user.partner_id

      LEFT JOIN account_move am
          ON am.partner_id = cliente.id
          AND am.company_id = 3
          AND am.move_type = 'out_invoice'
          AND am.state = 'posted'
          AND (
              am.name LIKE 'F%'
              OR am.name LIKE 'INTI%'
          )
          AND am.invoice_date >= CURRENT_DATE - INTERVAL '12 months'

      WHERE cliente.active = true
        AND cliente.customer_rank > 0
        ${asesorFilter}

      GROUP BY
    cliente.id,
    cliente.name,
    cliente.partner_latitude,
    cliente.partner_longitude,
    asesor_user.id,
    asesor_partner.name,
    DATE_TRUNC('month', am.invoice_date)::date

      ORDER BY
          asesor_partner.name,
          cliente.name,
          mes
    `,
      params
    );

    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      months.push(key);
    }

    const clientsMap = new Map();

    for (const row of rows) {
      const clientId = row.cliente_id;

      if (!clientsMap.has(clientId)) {
        const monthStatus = {};

        months.forEach((month) => {
          monthStatus[month] = false;
        });

        clientsMap.set(clientId, {
          cliente_id: row.cliente_id,
          cliente: row.cliente,
          partner_latitude: row.partner_latitude,
          partner_longitude: row.partner_longitude,
          asesor_id: row.asesor_id,
          asesor: row.asesor || "Sin asesor",
          months: monthStatus,
          estado: "Inactivo",
          totalFacturas12m: 0,
        });
      }

      if (row.mes) {
        const date = new Date(row.mes);

        const key = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (clientsMap.get(clientId).months[key] !== undefined) {
          const hasSales = Number(row.cantidad_facturas) > 0;

          clientsMap.get(clientId).months[key] = hasSales;
          clientsMap.get(clientId).totalFacturas12m += Number(
            row.cantidad_facturas || 0
          );
        }
      }
    }

    const result = Array.from(clientsMap.values());

    result.forEach((client) => {
      const last4 = months.slice(-4);

      const hasSales = last4.some((month) => client.months[month]);

      client.estado = hasSales ? "Activo" : "Inactivo";
    });

    res.json({
      months,
      data: result,
    });
  } catch (error) {
    console.error("ERROR RADIOGRAFIA:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

/* =========================
   CLIENTES MAPA
========================= */

app.get("/api/comercial/clientes-mapa", async (req, res) => {
  try {
    const { asesorId } = req.query;

    let filtroAsesor = "";
    const params = [];

    if (asesorId) {
      params.push(Number(asesorId));
      filtroAsesor = `AND ru.id = $${params.length}`;
    }

    const rows = await queryOdoo(
      `
      SELECT
          rp.id AS cliente_id,
          rp.name AS cliente,

          rp.street,
          rp.street2,
          rp.city,
          rp.zip,

          ru.id AS asesor_id,
          asesor_partner.name AS asesor,

          rp.partner_latitude,
          rp.partner_longitude

      FROM res_partner rp

      LEFT JOIN res_users ru
          ON ru.id = rp.user_id

      LEFT JOIN res_partner asesor_partner
          ON asesor_partner.id = ru.partner_id

      WHERE rp.active = true
        AND rp.customer_rank > 0
        AND rp.street IS NOT NULL
        AND rp.city IS NOT NULL
        ${filtroAsesor}

      ORDER BY asesor_partner.name, rp.name

      LIMIT 1000
      `,
      params
    );

    const clientesConCoords = [];

    for (const cliente of rows) {
      let lat = cliente.partner_latitude;
      let lng = cliente.partner_longitude;

      const invalidCoords =
        !lat ||
        !lng ||
        Number(lat) === 0 ||
        Number(lng) === 0;

      if (invalidCoords) {
        try {
          const direccion = encodeURIComponent(
            `${cliente.street}, ${cliente.city}, Argentina`
          );

          const geoUrl =
            `https://nominatim.openstreetmap.org/search?q=${direccion}&format=json&limit=1`;

          const geoResponse = await axios.get(geoUrl, {
            headers: {
              "User-Agent": "crm-lopez",
            },
            timeout: 8000,
          });

          if (geoResponse.data.length > 0) {
            lat = Number(geoResponse.data[0].lat);
            lng = Number(geoResponse.data[0].lon);
          }
        } catch (geoError) {
          console.error(
            "Error geocoding:",
            cliente.cliente
          );
        }
      }

      if (lat && lng) {
        clientesConCoords.push({
          ...cliente,
          lat,
          lng,
        });
      }
    }

    res.json(clientesConCoords);
  } catch (error) {
    console.error("ERROR CLIENTES MAPA:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});
/* =========================
   TEST EMAIL
========================= */

app.get("/api/odoo/clientes", async (req, res) => {
  try {
    const { asesorId } = req.query;

    const params = [];
    let asesorFilter = "";

    if (asesorId) {
      params.push(Number(asesorId));
      asesorFilter = `AND cliente.user_id = $${params.length}`;
    }

    const rows = await queryOdoo(
      `
      SELECT
        cliente.id AS cliente_id,
        cliente.name AS cliente,
        cliente.vat AS cuit,
        cliente.street,
        cliente.city,
        cliente.zip,
        cliente.user_id AS asesor_id,
        asesor_partner.name AS asesor
      FROM res_partner cliente
      LEFT JOIN res_users asesor_user
        ON asesor_user.id = cliente.user_id
      LEFT JOIN res_partner asesor_partner
        ON asesor_partner.id = asesor_user.partner_id
      WHERE cliente.active = true
        AND cliente.customer_rank > 0
        ${asesorFilter}
      ORDER BY cliente.name
      LIMIT 1000
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("ERROR CLIENTES ODOO:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/api/odoo/facturas", async (req, res) => {
  try {
    const { clienteId } = req.query;

    if (!clienteId) {
      return res.status(400).json({
        error: "clienteId es obligatorio",
      });
    }

    const rows = await queryOdoo(
      `
      SELECT
        am.id AS factura_id,
        am.name AS factura,
        am.partner_id AS cliente_id,
        rp.name AS cliente,
        am.invoice_date AS fecha,
        am.amount_total AS monto,
        am.payment_state,
        am.state
      FROM account_move am
      LEFT JOIN res_partner rp
        ON rp.id = am.partner_id
      WHERE am.company_id = 3
        AND am.partner_id = $1
        AND am.move_type = 'out_invoice'
        AND am.state = 'posted'
        AND am.invoice_date >= CURRENT_DATE - INTERVAL '6 months'
        AND (
          am.name LIKE 'F%'
          OR am.name LIKE 'INTI%'
        )
      ORDER BY am.invoice_date DESC
      LIMIT 100
      `,
      [Number(clienteId)]
    );

    res.json(rows);
  } catch (error) {
    console.error("ERROR FACTURAS ODOO:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/api/odoo/presupuestos", async (req, res) => {
  try {
    const { clienteId } = req.query;

    if (!clienteId) {
      return res.status(400).json({
        error: "clienteId es obligatorio",
      });
    }

    const rows = await queryOdoo(
      `
      SELECT
        so.id AS presupuesto_id,
        so.name AS presupuesto,
        so.partner_id AS cliente_id,
        rp.name AS cliente,
        so.amount_total AS monto,
        so.date_order AS fecha,
        so.state,
        so.user_id AS asesor_id
      FROM sale_order so
      LEFT JOIN res_partner rp
        ON rp.id = so.partner_id
      WHERE so.company_id = 3
        AND so.partner_id = $1
        AND so.state IN ('draft', 'sent')
        AND DATE_TRUNC('month', so.date_order) =
            DATE_TRUNC('month', CURRENT_DATE)
      ORDER BY so.date_order DESC
      LIMIT 100
      `,
      [Number(clienteId)]
    );

    res.json(rows);
  } catch (error) {
    console.error("ERROR PRESUPUESTOS ODOO:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});
/* =========================
   ODOO VENDEDORES
========================= */

app.get("/api/odoo/vendedores", async (req, res) => {
  try {
    const rows = await queryOdoo(`
      SELECT
        ru.id AS odoo_user_id,
        asesor_partner.name AS vendedor,
        ru.login,
        COUNT(cliente.id) AS clientes_asignados
      FROM res_partner cliente
      JOIN res_users ru
        ON ru.id = cliente.user_id
      JOIN res_partner asesor_partner
        ON asesor_partner.id = ru.partner_id
      WHERE cliente.active = true
        AND cliente.customer_rank > 0
      GROUP BY
        ru.id,
        asesor_partner.name,
        ru.login
      ORDER BY asesor_partner.name
    `);

    res.json(rows);
  } catch (error) {
    console.error("ERROR VENDEDORES ODOO:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});/* =========================
   BUSCADOR CLIENTES ODOO
========================= */

app.get("/api/odoo/clientes/search", async (req, res) => {
  try {
    const { q = "", odoo_user_id, role } = req.query;

    let vendedorFilter = "";
    const params = [];

    if (role === "vendedor" && odoo_user_id) {
      params.push(Number(odoo_user_id));
      vendedorFilter = `AND cliente.user_id = $${params.length}`;
    }

    params.push(`%${q}%`);

    const rows = await queryOdoo(
      `
      SELECT
        cliente.id AS cliente_id,
        cliente.name AS cliente,
        cliente.vat AS cuit,
        cliente.city,
        cliente.user_id
      FROM res_partner cliente
      WHERE cliente.active = true
        AND cliente.customer_rank > 0
        ${vendedorFilter}
        AND cliente.name ILIKE $${params.length}
      ORDER BY cliente.name
      LIMIT 30
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("ERROR SEARCH CLIENTES:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

/* =========================
   PERFIL COMERCIAL CLIENTE + LEADS DESDE RADIOGRAFIA
========================= */

app.get("/api/comercial/clientes/:clienteId/perfil", async (req, res) => {
  const { clienteId } = req.params;

  if (!clienteId) {
    return res.status(400).json({ error: "clienteId es obligatorio" });
  }

  const id = Number(clienteId);

  try {
    let cliente = null;
    let ultimasCompras = [];
    let categorias = [];
    let presupuestos = [];
    let oportunidades = [];
    let deuda = null;

    try {
      const clienteRows = await queryOdoo(
        `
        SELECT
          rp.id AS cliente_id,
          rp.name AS cliente,
          rp.vat AS cuit,
          rp.phone,
          rp.mobile,
          rp.email,
          rp.city,
          rp.street,
          rp.user_id AS asesor_id,
          asesor_partner.name AS asesor,
          pt.name AS condicion_pago
        FROM res_partner rp
        LEFT JOIN res_users ru
          ON ru.id = rp.user_id
        LEFT JOIN res_partner asesor_partner
          ON asesor_partner.id = ru.partner_id
        LEFT JOIN account_payment_term pt
          ON pt.id = rp.property_payment_term_id
        WHERE rp.id = $1
        LIMIT 1
        `,
        [id]
      );

      cliente = clienteRows[0] || null;
    } catch (error) {
      console.error("ERROR PERFIL CLIENTE BASE:", error.message);

      try {
        const fallbackRows = await queryOdoo(
          `
          SELECT
            rp.id AS cliente_id,
            rp.name AS cliente,
            rp.vat AS cuit,
            rp.phone,
            rp.mobile,
            rp.email,
            rp.city,
            rp.street,
            rp.user_id AS asesor_id,
            asesor_partner.name AS asesor
          FROM res_partner rp
          LEFT JOIN res_users ru
            ON ru.id = rp.user_id
          LEFT JOIN res_partner asesor_partner
            ON asesor_partner.id = ru.partner_id
          WHERE rp.id = $1
          LIMIT 1
          `,
          [id]
        );

        cliente = fallbackRows[0] || null;
      } catch (fallbackError) {
        console.error("ERROR PERFIL CLIENTE FALLBACK:", fallbackError.message);
      }
    }

    try {
      ultimasCompras = await queryOdoo(
        `
        SELECT
          am.id AS factura_id,
          am.name AS factura,
          am.invoice_date AS fecha,
          am.amount_total AS monto,
          am.payment_state,
          am.state
        FROM account_move am
        WHERE am.partner_id = $1
          AND am.company_id = 3
          AND am.move_type = 'out_invoice'
          AND am.state = 'posted'
          AND (
            am.name LIKE 'F%'
            OR am.name LIKE 'INTI%'
          )
        ORDER BY am.invoice_date DESC
        LIMIT 10
        `,
        [id]
      );
    } catch (error) {
      console.error("ERROR PERFIL ULTIMAS COMPRAS:", error.message);
    }

    try {
      categorias = await queryOdoo(
        `
        SELECT
          COALESCE(pc.complete_name, pc.name, 'Sin categoría') AS categoria,
          COUNT(DISTINCT am.id) AS facturas,
          SUM(aml.quantity) AS unidades,
          SUM(aml.price_total) AS monto
        FROM account_move_line aml
        JOIN account_move am
          ON am.id = aml.move_id
        LEFT JOIN product_product pp
          ON pp.id = aml.product_id
        LEFT JOIN product_template pt
          ON pt.id = pp.product_tmpl_id
        LEFT JOIN product_category pc
          ON pc.id = pt.categ_id
        WHERE am.partner_id = $1
          AND am.company_id = 3
          AND am.move_type = 'out_invoice'
          AND am.state = 'posted'
          AND aml.product_id IS NOT NULL
          AND am.invoice_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY COALESCE(pc.complete_name, pc.name, 'Sin categoría')
        ORDER BY monto DESC NULLS LAST
        LIMIT 12
        `,
        [id]
      );
    } catch (error) {
      console.error("ERROR PERFIL CATEGORIAS:", error.message);
    }

    try {
      presupuestos = await queryOdoo(
        `
        SELECT
          so.id AS presupuesto_id,
          so.name AS presupuesto,
          so.amount_total AS monto,
          so.date_order AS fecha,
          so.state
        FROM sale_order so
        WHERE so.partner_id = $1
          AND so.company_id = 3
        ORDER BY so.date_order DESC
        LIMIT 10
        `,
        [id]
      );
    } catch (error) {
      console.error("ERROR PERFIL PRESUPUESTOS:", error.message);
    }

    try {
      const deudaRows = await queryOdoo(
        `
        SELECT
          SUM(am.amount_residual) AS deuda_pendiente,
          COUNT(am.id) AS facturas_pendientes
        FROM account_move am
        WHERE am.partner_id = $1
          AND am.company_id = 3
          AND am.move_type = 'out_invoice'
          AND am.state = 'posted'
          AND am.amount_residual > 0
        `,
        [id]
      );

      deuda = deudaRows[0] || null;
    } catch (error) {
      console.error("ERROR PERFIL DEUDA:", error.message);
    }

    try {
      oportunidades = db.prepare(`
        SELECT *
        FROM crm_opportunities
        WHERE odoo_cliente_id = ?
           OR external_reference = ?
           OR client = ?
        ORDER BY id DESC
        LIMIT 20
      `).all(id, `odoo:${id}`, cliente?.cliente || "");
    } catch (error) {
      console.error("ERROR PERFIL OPORTUNIDADES CRM:", error.message);
    }

    const total12m = categorias.reduce((sum, row) => sum + Number(row.monto || 0), 0);
    const categoriaPrincipal = categorias[0]?.categoria || "Sin categoría dominante";
    const ultimaCompra = ultimasCompras[0]?.fecha || null;

    res.json({
      cliente,
      resumen: {
        total12m,
        categoriaPrincipal,
        ultimaCompra,
        condicionPago: cliente?.condicion_pago || "No disponible",
        deudaPendiente: Number(deuda?.deuda_pendiente || 0),
        facturasPendientes: Number(deuda?.facturas_pendientes || 0),
      },
      ultimasCompras,
      categorias,
      presupuestos,
      oportunidades,
      deuda,
    });
  } catch (error) {
    console.error("ERROR PERFIL COMERCIAL CLIENTE:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/comercial/clientes/:clienteId/asignar-lead", (req, res) => {
  try {
    const { clienteId } = req.params;
    const data = req.body || {};

    const cliente = data.cliente || data.client || `Cliente ${clienteId}`;
    const assignedTo = data.assigned_to || data.assignedTo || "";
    const userName = data.user || "Sistema";
    const reason = data.reason || "Reactivación desde radiografía comercial";
    const segment = data.segment || "General";
    const priority = data.priority || "Alta";

    const result = db.prepare(`
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
        campaign_id,
        lead_source,
        channel,
        external_reference,
        odoo_cliente_id
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        datetime('now'), datetime('now'), date('now', '+1 day'), ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      `Reactivación - ${cliente}`,
      cliente,
      data.contact_name || "",
      data.phone || "",
      data.email || "",
      segment,
      "Radiografía comercial",
      "Reactivación",
      "Prospecto",
      "Abierta",
      userName,
      data.user_role || "supervisor",
      assignedTo,
      priority,
      Number(data.expected_amount || 0),
      reason,
      data.next_action || "Llamar cliente",
      "ok",
      null,
      "Radiografía comercial",
      "CRM",
      `odoo:${clienteId}`,
      Number(clienteId)
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
      result.lastInsertRowid,
      "Lead",
      "Asignado desde radiografía",
      reason,
      userName
    );

    if (assignedTo && createNotification) {
      const title = "Nuevo lead de reactivación";
      const message = `Se asignó ${cliente} para contactar desde radiografía comercial.`;

      createNotification({
        userName: assignedTo,
        requestId: result.lastInsertRowid,
        title,
        message,
      });

      if (emailUserByName && fireAndForget) {
        fireAndForget(
          emailUserByName(assignedTo, title, message, result.lastInsertRowid),
          "Error email lead asignado:"
        );
      }
    }

    const created = db.prepare(`
      SELECT *
      FROM crm_opportunities
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.json(created);
  } catch (error) {
    console.error("ERROR ASIGNAR LEAD RADIOGRAFIA:", error);
    res.status(500).json({ error: error.message });
  }
});

};
