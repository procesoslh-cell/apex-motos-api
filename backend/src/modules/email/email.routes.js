module.exports = function registerRoutes(context) {
  const { app, db, axios, queryOdoo, sendEmail, fireAndForget, emailTemplate, publicUser, getUserByName, getUsersByRole, emailUsersByRole, emailUserByName, emailCustomer, createNotification, addHistory, getRequestById, upload, uploadCollection, uploadsDir, mailEnabled } = context;


app.get("/api/email/status", (req, res) => {
  res.json({
    enabled: Boolean(mailEnabled),
    smtpHost: Boolean(process.env.SMTP_HOST),
    smtpUser: Boolean(process.env.SMTP_USER),
    smtpPass: Boolean(process.env.SMTP_PASS),
    smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || "",
    appUrl: process.env.APP_URL || "http://localhost:5173",
  });
});

app.post("/api/test-email", async (req, res) => {
  const { to } = req.body;

  res.json({ ok: true, message: "Prueba enviada en segundo plano" });

  fireAndForget(
    sendEmail({
      to: to || process.env.SMTP_USER,
      subject: "Prueba Gestor de Solicitudes",
      html: emailTemplate({
        title: "Prueba de email",
        message:
          "Si recibiste este correo, la configuración SMTP funciona correctamente.",
      }),
    }),
    "Error test email:"
  );
});

/* =========================
   AUTH / USERS
========================= */
};
