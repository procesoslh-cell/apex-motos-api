module.exports = function registerCampaignRoutes(context) {
  const { app, db, createNotification } = context;

  function safeText(value) {
    return String(value || '').trim();
  }

  app.get('/api/crm/campaigns', (req, res) => {
    try {
      const campaigns = db.prepare(`
        SELECT *
        FROM crm_campaigns
        ORDER BY id DESC
      `).all();

      const counts = db.prepare(`
        SELECT campaign_id, COUNT(*) AS total
        FROM crm_campaign_clients
        GROUP BY campaign_id
      `).all();

      const leadCounts = db.prepare(`
        SELECT campaign_id, COUNT(*) AS generated
        FROM crm_campaign_clients
        WHERE lead_opportunity_id IS NOT NULL
        GROUP BY campaign_id
      `).all();

      const countMap = new Map(counts.map((item) => [item.campaign_id, item.total]));
      const leadMap = new Map(leadCounts.map((item) => [item.campaign_id, item.generated]));

      res.json(campaigns.map((campaign) => ({
        ...campaign,
        clients_count: countMap.get(campaign.id) || 0,
        leads_generated: leadMap.get(campaign.id) || 0,
      })));
    } catch (error) {
      console.error('ERROR CAMPAIGNS LIST:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/crm/campaigns', (req, res) => {
    try {
      const data = req.body || {};

      const result = db.prepare(`
        INSERT INTO crm_campaigns (
          name, type, segment, owner, assigned_to, status, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        safeText(data.name) || 'Campaña comercial',
        safeText(data.type) || 'Reactivación',
        safeText(data.segment) || 'General',
        safeText(data.owner),
        safeText(data.assigned_to),
        safeText(data.status) || 'Activa',
        safeText(data.notes)
      );

      const campaign = db.prepare('SELECT * FROM crm_campaigns WHERE id = ?').get(result.lastInsertRowid);
      res.json(campaign);
    } catch (error) {
      console.error('ERROR CAMPAIGN CREATE:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/crm/campaigns/:id', (req, res) => {
    try {
      const { id } = req.params;
      const campaign = db.prepare('SELECT * FROM crm_campaigns WHERE id = ?').get(id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
      }

      const clients = db.prepare(`
        SELECT *
        FROM crm_campaign_clients
        WHERE campaign_id = ?
        ORDER BY id DESC
      `).all(id);

      res.json({ ...campaign, clients });
    } catch (error) {
      console.error('ERROR CAMPAIGN DETAIL:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/crm/campaigns/:id/clients', (req, res) => {
    try {
      const { id } = req.params;
      const { clients = [], assigned_to } = req.body || {};

      const campaign = db.prepare('SELECT * FROM crm_campaigns WHERE id = ?').get(id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
      }

      const stmt = db.prepare(`
        INSERT INTO crm_campaign_clients (
          campaign_id, cliente_id, cliente, contact_name, phone, email, segment,
          assigned_to, status, last_purchase_at, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      let inserted = 0;
      for (const item of clients) {
        const clientName = safeText(item.cliente || item.client || item.name);
        if (!clientName) continue;

        stmt.run(
          id,
          item.cliente_id || item.client_id || null,
          clientName,
          safeText(item.contact_name),
          safeText(item.phone),
          safeText(item.email),
          safeText(item.segment || campaign.segment),
          safeText(item.assigned_to || assigned_to || campaign.assigned_to),
          'Pendiente',
          safeText(item.last_purchase_at),
          safeText(item.notes)
        );
        inserted += 1;
      }

      res.json({ success: true, inserted });
    } catch (error) {
      console.error('ERROR CAMPAIGN CLIENTS:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/crm/campaigns/:id/generate-leads', (req, res) => {
    try {
      const { id } = req.params;
      const { user = 'Sistema' } = req.body || {};

      const campaign = db.prepare('SELECT * FROM crm_campaigns WHERE id = ?').get(id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
      }

      const clients = db.prepare(`
        SELECT *
        FROM crm_campaign_clients
        WHERE campaign_id = ?
          AND lead_opportunity_id IS NULL
      `).all(id);

      const insertOpportunity = db.prepare(`
        INSERT INTO crm_opportunities (
          title, client, contact_name, phone, email, segment, source, type, stage,
          status, owner, owner_role, assigned_to, priority, expected_amount, notes,
          created_at, updated_at, next_action_date, next_action, sla_status,
          campaign_id, lead_source, channel
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          datetime('now'), datetime('now'), date('now', '+1 day'), ?, ?, ?, ?, ?)
      `);

      const updateClient = db.prepare(`
        UPDATE crm_campaign_clients
        SET lead_opportunity_id = ?, status = 'Lead generado', updated_at = datetime('now')
        WHERE id = ?
      `);

      let generated = 0;
      for (const client of clients) {
        const result = insertOpportunity.run(
          `${campaign.type || 'Reactivación'} - ${client.cliente}`,
          client.cliente,
          client.contact_name || '',
          client.phone || '',
          client.email || '',
          client.segment || campaign.segment || '',
          `Campaña #${campaign.id}`,
          campaign.type || 'Reactivación',
          'Prospecto',
          'Abierta',
          user,
          'supervisor',
          client.assigned_to || campaign.assigned_to || '',
          'Media',
          0,
          client.notes || `Lead generado desde campaña ${campaign.name}`,
          'Contactar cliente',
          'ok',
          campaign.id,
          'Campaña comercial',
          'CRM'
        );
        updateClient.run(result.lastInsertRowid, client.id);
        generated += 1;

        if (client.assigned_to && createNotification) {
          createNotification({
            userName: client.assigned_to,
            requestId: result.lastInsertRowid,
            title: 'Nuevo lead asignado',
            message: `Se asignó ${client.cliente} desde la campaña ${campaign.name}.`,
          });
        }
      }

      res.json({ success: true, generated });
    } catch (error) {
      console.error('ERROR CAMPAIGN GENERATE LEADS:', error);
      res.status(500).json({ error: error.message });
    }
  });
};
