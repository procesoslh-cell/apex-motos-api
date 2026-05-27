module.exports = function registerRoutes(context) {
  const { app, db, axios, queryOdoo, sendEmail, fireAndForget, emailTemplate, publicUser, getUserByName, getUsersByRole, emailUsersByRole, emailUserByName, emailCustomer, createNotification, addHistory, getRequestById, upload, uploadCollection, uploadsDir, mailEnabled } = context;

app.get("/api/users", (req, res) => {
  const users = db
    .prepare(`
      SELECT
        id,
        username,
        name,
        email,
        role,
        active,
        business_unit,
        supervisor_id,
        odoo_user_id,
        createdAt
      FROM users
      ORDER BY name
    `)
    .all();

  res.json(users);
});

app.post("/api/users", (req, res) => {
  const {
    username,
    password,
    name,
    email,
    role,
    business_unit,
    supervisor_id,
    odoo_user_id,
  } = req.body;

  if (!username || !password || !name || !role) {
    return res.status(400).json({
      error: "Faltan datos obligatorios",
    });
  }

  try {
    const result = db
      .prepare(`
        INSERT INTO users (
          username,
          password,
          name,
          email,
          role,
          active,
          business_unit,
          supervisor_id,
          odoo_user_id,
          createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        username,
        password,
        name,
        email || "",
        role,
        1,
        business_unit || null,
        supervisor_id || null,
        odoo_user_id || null,
        new Date().toISOString()
      );

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);

    res.status(201).json(publicUser(user));
  } catch (error) {
    console.error("ERROR CREANDO USUARIO:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.patch("/api/users/:id/toggle", (req, res) => {
  const id = req.params.id;

  const user = db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(id);

  if (!user) {
    return res.status(404).json({
      error: "Usuario no encontrado",
    });
  }

  const newStatus = user.active ? 0 : 1;

  db.prepare(`
    UPDATE users
    SET active = ?
    WHERE id = ?
  `).run(newStatus, id);

  const updated = db
    .prepare(`
      SELECT
  id,
  username,
  name,
  email,
  role,
  active,
  business_unit,
  supervisor_id,
  odoo_user_id,
  createdAt
      FROM users
      WHERE id = ?
    `)
    .get(id);

  res.json(updated);
});

/* =========================
   REQUESTS
========================= */

};
