module.exports = function registerOmnichannelRoutes(context) {
  const { app, db, createNotification } = context;

  function safeText(value) {
    return String(value || '').trim();
  }

  app.get('/api/omnichannel/inbox', (req, res) => {
    try {
      const { status = 'Nuevo' } = req.query;
      const rows = db.prepare(`
        SELECT *
        FROM crm_inbound_messages
        WHERE (? = 'all' OR status = ?)
        ORDER BY id DESC
      `).all(status, status);
      res.json(rows);
    } catch (error) {
      console.error('ERROR OMNI INBOX:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/public/leads', (req, res) => {
    try {
      const data = req.body || {};
      const channel = safeText(data.channel) || 'Web';
      const client = safeText(data.client || data.company || data.name) || 'Lead sin nombre';
      const contactName = safeText(data.contact_name || data.name) || client;
      const phone = safeText(data.phone || data.mobile);
      const email = safeText(data.email);
      const message = safeText(data.message || data.notes || 'Lead recibido');
      const segment = safeText(data.segment) || 'General';
      const assignedTo = safeText(data.assigned_to);

      const msgResult = db.prepare(`
        INSERT INTO crm_inbound_messages (
          channel, external_id, contact_name, phone, email, client, message,
          segment, status, assigned_to, raw_payload, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        channel,
        safeText(data.external_id) || `lead-${Date.now()}`,
        contactName,
        phone,
        email,
        client,
        message,
        segment,
        'Nuevo',
        assignedTo,
        JSON.stringify(data)
      );

      const opportunityResult = db.prepare(`
        INSERT INTO crm_opportunities (
          title, client, contact_name, phone, email, segment, source, type, stage,
          status, owner, owner_role, assigned_to, priority, expected_amount, notes,
          created_at, updated_at, next_action_date, next_action, sla_status,
          lead_source, channel, external_reference
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          datetime('now'), datetime('now'), date('now', '+1 day'), ?, ?, ?, ?, ?)
      `).run(
        `Lead ${channel} - ${client}`,
        client,
        contactName,
        phone,
        email,
        segment,
        channel,
        'Lead',
        'Prospecto',
        'Abierta',
        'Sistema',
        'automation',
        assignedTo,
        'Alta',
        Number(data.expected_amount || 0),
        message,
        'Primer contacto',
        'ok',
        channel,
        channel,
        String(msgResult.lastInsertRowid)
      );

      db.prepare(`
        UPDATE crm_inbound_messages
        SET opportunity_id = ?, status = 'Convertido', updated_at = datetime('now')
        WHERE id = ?
      `).run(opportunityResult.lastInsertRowid, msgResult.lastInsertRowid);

      if (assignedTo && createNotification) {
        createNotification({
          userName: assignedTo,
          requestId: opportunityResult.lastInsertRowid,
          title: 'Nuevo lead omnicanal',
          message: `${client} ingresó por ${channel}.`,
        });
      }

      res.json({
        success: true,
        messageId: msgResult.lastInsertRowid,
        opportunityId: opportunityResult.lastInsertRowid,
      });
    } catch (error) {
      console.error('ERROR PUBLIC LEAD:', error);
      res.status(500).json({ error: error.message });
    }
  });
};
