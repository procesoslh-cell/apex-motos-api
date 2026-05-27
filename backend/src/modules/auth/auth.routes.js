module.exports = function registerRoutes(context) {
  const { app, db, axios, queryOdoo, sendEmail, fireAndForget, emailTemplate, publicUser, getUserByName, getUsersByRole, emailUsersByRole, emailUserByName, emailCustomer, createNotification, addHistory, getRequestById, upload, uploadCollection, uploadsDir, mailEnabled } = context;

app.post("/api/reset-passwords", (req, res) => {
  if (process.env.DEMO_RESET_ENABLED !== "true") {
    return res.status(403).json({
      error: "Reset de demo deshabilitado",
    });
  }

  db.prepare(`
    UPDATE users
    SET password = '1234'
  `).run();

  res.json({
    success: true,
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const user = db
    .prepare(`
      SELECT *
      FROM users
      WHERE username = ?
        AND password = ?
        AND active = 1
    `)
    .get(username, password);

  if (!user) {
    return res.status(401).json({
      error: "Usuario o contraseña incorrectos",
    });
  }

  res.json(publicUser(user));
});

};
