module.exports = function registerRoutes(context) {
  const { app, db, axios, queryOdoo, sendEmail, fireAndForget, emailTemplate, publicUser, getUserByName, getUsersByRole, emailUsersByRole, emailUserByName, emailCustomer, createNotification, addHistory, getRequestById, upload, uploadCollection, uploadsDir, mailEnabled } = context;

app.get("/api/dashboard/comercial", (req, res) => {
  try {
    const totalTrips = db.prepare(`
      SELECT COUNT(*) AS total
      FROM trips
    `).get();

    const closedTrips = db.prepare(`
      SELECT COUNT(*) AS total
      FROM trips
      WHERE status = 'Pendiente revisión'
    `).get();

    const totalVisits = db.prepare(`
      SELECT COUNT(*) AS total
      FROM trip_clients
      WHERE visit_status = 'Visitado'
    `).get();

    const pendingVisits = db.prepare(`
      SELECT COUNT(*) AS total
      FROM trip_clients
      WHERE visit_status IS NULL
    `).get();

    const totalOrders = db.prepare(`
      SELECT
        COALESCE(SUM(result_orders_count), 0) AS total
      FROM trips
    `).get();

    const totalAmount = db.prepare(`
      SELECT
        COALESCE(SUM(result_estimated_amount), 0) AS total
      FROM trips
    `).get();

    const topVendors = db.prepare(`
      SELECT
        asesor,
        COUNT(*) AS giras,
        COALESCE(SUM(result_orders_count), 0) AS pedidos,
        COALESCE(SUM(result_estimated_amount), 0) AS monto
      FROM trips
      GROUP BY asesor
      ORDER BY monto DESC
      LIMIT 10
    `).all();
      const pendingRequests = db.prepare(`
  SELECT COUNT(*) AS total
  FROM requests
  WHERE status NOT IN ('Finalizada', 'Rechazada', 'Rechazada por supervisor')
`).get();

const pendingCreditNotes = db.prepare(`
  SELECT COUNT(*) AS total
  FROM requests
  WHERE type = 'Nota de crédito'
    AND status = 'Pendiente aprobación supervisor'
`).get();

const expiredSla = db.prepare(`
  SELECT COUNT(*) AS total
  FROM requests
  WHERE status NOT IN ('Finalizada', 'Rechazada', 'Rechazada por supervisor')
    AND createdAt IS NOT NULL
    AND ((julianday('now') - julianday(createdAt)) * 24) >= 72
`).get();

const activeTrips = db.prepare(`
  SELECT COUNT(*) AS total
  FROM trips
  WHERE status IS NULL
     OR status != 'Pendiente revisión'
`).get();
    res.json({
      kpis: {
        totalTrips: totalTrips.total,
        closedTrips: closedTrips.total,
        totalVisits: totalVisits.total,
        pendingVisits: pendingVisits.total,
        totalOrders: totalOrders.total,
        totalAmount: totalAmount.total,
        pendingRequests: pendingRequests.total,
        pendingCreditNotes: pendingCreditNotes.total,
        expiredSla: expiredSla.total,
        activeTrips: activeTrips.total,

      },

      topVendors,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});
/* =========================
   SERVER
========================= */
/* =========================
   DASHBOARD COMERCIAL
========================= */

};
