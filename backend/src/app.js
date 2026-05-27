const initializeDatabase = require("./db/schema");
const context = require("./core/context");

initializeDatabase();

context.app.get("/", (req, res) => {
  res.send("Gestor operativo");
});

require("./modules/odoo/odoo.routes")(context);
require("./modules/email/email.routes")(context);
require("./modules/auth/auth.routes")(context);
require("./modules/users/users.routes")(context);
require("./modules/requests/requests.routes")(context);
require("./modules/notifications/notifications.routes")(context);
require("./modules/trips/trips.routes")(context);
require("./modules/dashboard/dashboard.routes")(context);
require("./modules/collections/collections.routes")(context);
require("./modules/crm/crm.routes")(context);
require("./modules/campaigns/campaigns.routes")(context);
require("./modules/omnichannel/omnichannel.routes")(context);
require("./modules/sales/sales.routes")(context);

module.exports = context.app;
