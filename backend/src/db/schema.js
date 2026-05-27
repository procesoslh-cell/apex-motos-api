const db = require("./index");

function initializeDatabase() {
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  name TEXT,
  email TEXT,
  role TEXT,
  active INTEGER DEFAULT 1,
  createdAt TEXT
)
`).run();
try {
  db.prepare(`
    ALTER TABLE users
    ADD COLUMN odoo_user_id INTEGER
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE users
    ADD COLUMN supervisor_id INTEGER
  `).run();
} catch {}
db.prepare(`
  CREATE TABLE IF NOT EXISTS collection_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER,
    filename TEXT,
    original_name TEXT,
    uploaded_at TEXT
  )
`).run();
try {
  db.prepare(`
    ALTER TABLE users
    ADD COLUMN business_unit TEXT
  `).run();
} catch {}
db.prepare(`
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  client TEXT,
  requester TEXT,
  area TEXT,
  priority TEXT,
  status TEXT,
  dueDate TEXT,
  createdAt TEXT,
  fantasyName TEXT,
  businessName TEXT,
  cuit TEXT,
  email TEXT,
  mobile TEXT,
  storeAddress TEXT,
  deliveryAddress TEXT,
  postalCodeCity TEXT,
  description TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requestId INTEGER,
  author TEXT,
  comment TEXT,
  createdAt TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requestId INTEGER,
  user TEXT,
  action TEXT,
  createdAt TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS request_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requestId INTEGER,
  category TEXT,
  originalName TEXT,
  filename TEXT,
  url TEXT,
  uploadedAt TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userRole TEXT,
  userName TEXT,
  requestId INTEGER,
  title TEXT,
  message TEXT,
  isRead INTEGER DEFAULT 0,
  createdAt TEXT
)
`).run();
/* =========================
   CRM ERP / PRESUPUESTOS
========================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_opportunity_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  product_code TEXT,
  product_name TEXT,
  quantity REAL,
  unit_price REAL,
  total REAL,
  created_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_erp_sync (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  erp_type TEXT,
  erp_document_type TEXT,
  erp_document_id TEXT,
  erp_document_number TEXT,
  sync_status TEXT,
  payload TEXT,
  error_message TEXT,
  created_at TEXT,
  updated_at TEXT
)
`).run();

try {
  db.prepare(`
    ALTER TABLE crm_opportunities
    ADD COLUMN erp_status TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE crm_opportunities
    ADD COLUMN erp_quote_number TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE crm_opportunities
    ADD COLUMN erp_quote_id TEXT
  `).run();
} catch {}
/* =========================
   GIRAS COMERCIALES
========================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asesor_id INTEGER,
  asesor TEXT,
  nombre TEXT,
  mes TEXT,
  observaciones TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT,
  result_orders_count INTEGER,
  result_estimated_amount REAL,
  result_notes TEXT,
  closed_at TEXT,
  supervisor_status TEXT,
  supervisor_comments TEXT,
  supervisor_reviewed_by TEXT,
  supervisor_reviewed_at TEXT,
  created_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS trip_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER,
  cliente_id INTEGER,
  cliente TEXT,
  estado TEXT,

  partner_latitude REAL,
  partner_longitude REAL
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS trip_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER,
  cliente_id INTEGER,
  comentario TEXT,
  lat REAL,
  lng REAL,
  visitado_at TEXT
)
`).run();

/* =========================
   GIRAS - MIGRACIONES
========================= */

[
  ["trips", "start_date", "TEXT"],
  ["trips", "end_date", "TEXT"],
  ["trips", "status", "TEXT"],
  ["trips", "result_orders_count", "INTEGER"],
  ["trips", "result_estimated_amount", "REAL"],
  ["trips", "result_notes", "TEXT"],
  ["trips", "closed_at", "TEXT"],
  ["trips", "supervisor_status", "TEXT"],
  ["trips", "supervisor_comments", "TEXT"],
  ["trips", "supervisor_reviewed_by", "TEXT"],
  ["trips", "supervisor_reviewed_at", "TEXT"],
].forEach(([table, column, type]) => {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  } catch {}
});

/* =========================
   COBRANZAS
========================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  cliente_id INTEGER,
  cliente TEXT,

  asesor_id INTEGER,
  asesor TEXT,

  total REAL,

  payment_method TEXT,
  status TEXT,

  notes TEXT,

  receipt_number TEXT,

  created_at TEXT,
  validated_at TEXT,
  validated_by TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS collection_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  collection_id INTEGER,

  invoice_id INTEGER,
  invoice_number TEXT,

  amount REAL
)
`).run();
/* =========================
   CRM OPORTUNIDADES
========================= */

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  client TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  segment TEXT,
  source TEXT,
  type TEXT,
  stage TEXT,
  status TEXT,
  owner TEXT,
  owner_role TEXT,
  assigned_to TEXT,
  priority TEXT,
  expected_amount REAL,
  notes TEXT,
  loss_reason TEXT,
  created_at TEXT,
  updated_at TEXT,
  next_action_date TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  type TEXT,
  result TEXT,
  comment TEXT,
  user TEXT,
  created_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_stage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  from_stage TEXT,
  to_stage TEXT,
  user TEXT,
  created_at TEXT
)
`).run();
/* =========================
   INITIAL USERS
========================= */

function ensureUser({ username, password, name, email, role }) {
  const existing = db
    .prepare(`SELECT * FROM users WHERE username = ?`)
    .get(username);

  if (existing) return;

  db.prepare(`
    INSERT INTO users (
      username, password, name, email, role, active, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    username,
    password,
    name,
    email,
    role,
    1,
    new Date().toISOString()
  );
}

ensureUser({
  username: "fabian",
  password: "1234",
  name: "Fabian Ramos",
  email: "fabianramos@lopezhnos.com.ar",
  role: "vendedor",
});

ensureUser({
  username: "cuentas",
  password: "1234",
  name: "Cuentas Corrientes",
  email: process.env.CC_EMAIL || "cuentas@lopezhnos.com.ar",
  role: "cuentas",
});

ensureUser({
  username: "admin",
  password: "1234",
  name: "Administrador",
  email: "admin@lopezhnos.com.ar",
  role: "admin",
});
try {
  db.prepare(`
    ALTER TABLE trips
    ADD COLUMN closed_at TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trips
    ADD COLUMN result_orders_count INTEGER
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trips
    ADD COLUMN result_estimated_amount REAL
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trips
    ADD COLUMN result_notes TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trip_clients
    ADD COLUMN visit_status TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trip_clients
    ADD COLUMN visit_comment TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trip_clients
    ADD COLUMN visited_at TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trip_clients
    ADD COLUMN visited_lat REAL
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trip_clients
    ADD COLUMN visited_lng REAL
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trip_clients
    ADD COLUMN partner_latitude REAL
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE trip_clients
    ADD COLUMN partner_longitude REAL
  `).run();
} catch {}
try {
  db.prepare(`
    ALTER TABLE collections
    ADD COLUMN observation_reason TEXT
  `).run();
} catch {}
/* =========================
   DASHBOARD COMERCIAL
========================= */


try {
  db.prepare(`
    ALTER TABLE crm_opportunities
    ADD COLUMN erp_status TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE crm_opportunities
    ADD COLUMN erp_quote_number TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE crm_opportunities
    ADD COLUMN erp_quote_id TEXT
  `).run();
} catch {}

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_opportunity_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  product_code TEXT,
  product_name TEXT,
  quantity REAL,
  unit_price REAL,
  total REAL,
  created_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_erp_sync (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  erp_type TEXT,
  erp_document_type TEXT,
  erp_document_id TEXT,
  erp_document_number TEXT,
  sync_status TEXT,
  payload TEXT,
  error_message TEXT,
  created_at TEXT,
  updated_at TEXT
)
`).run();



/* =========================
   CRM PLATFORM EXTENSIONS
   Campañas, omnicanalidad y alertas
========================= */

function addColumnIfMissing(table, column, definition) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  } catch {}
}

addColumnIfMissing("crm_opportunities", "next_action_date", "TEXT");
addColumnIfMissing("crm_opportunities", "next_action", "TEXT");
addColumnIfMissing("crm_opportunities", "sla_status", "TEXT");
addColumnIfMissing("crm_opportunities", "last_activity_at", "TEXT");
addColumnIfMissing("crm_opportunities", "campaign_id", "INTEGER");
addColumnIfMissing("crm_opportunities", "lead_source", "TEXT");
addColumnIfMissing("crm_opportunities", "channel", "TEXT");
addColumnIfMissing("crm_opportunities", "external_reference", "TEXT");
addColumnIfMissing("crm_opportunities", "odoo_cliente_id", "INTEGER");
addColumnIfMissing("crm_opportunities", "erp_status", "TEXT");
addColumnIfMissing("crm_opportunities", "erp_quote_number", "TEXT");
addColumnIfMissing("crm_opportunities", "erp_quote_id", "TEXT");

addColumnIfMissing("collections", "observation_reason", "TEXT");

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  type TEXT,
  segment TEXT,
  owner TEXT,
  assigned_to TEXT,
  status TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_campaign_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER,
  cliente_id INTEGER,
  cliente TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  segment TEXT,
  assigned_to TEXT,
  status TEXT,
  last_purchase_at TEXT,
  notes TEXT,
  lead_opportunity_id INTEGER,
  created_at TEXT,
  updated_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_inbound_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT,
  external_id TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  client TEXT,
  message TEXT,
  segment TEXT,
  status TEXT,
  assigned_to TEXT,
  opportunity_id INTEGER,
  raw_payload TEXT,
  created_at TEXT,
  updated_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS crm_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  type TEXT,
  severity TEXT,
  title TEXT,
  message TEXT,
  assigned_to TEXT,
  status TEXT,
  created_at TEXT,
  resolved_at TEXT
)
`).run();

  console.log("Database initialized");
}

module.exports = initializeDatabase;

/* =========================
   PRESUPUESTOS / VENTAS - EXTENSION
========================= */
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE,
      name TEXT,
      category TEXT,
      price REAL,
      stock REAL,
      active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )
  `).run();
} catch {}

try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sales_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client TEXT,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      seller TEXT,
      assigned_to TEXT,
      status TEXT,
      payment_method TEXT,
      payment_received REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      discount_total REAL DEFAULT 0,
      total REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      notes TEXT,
      sale_number TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      converted_at TEXT
    )
  `).run();
} catch {}

try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sales_budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER,
      product_id INTEGER,
      sku TEXT,
      product_name TEXT,
      quantity REAL,
      original_price REAL,
      unit_price REAL,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      final_price REAL,
      line_total REAL,
      stock_available REAL,
      created_at TEXT,
      updated_at TEXT
    )
  `).run();
} catch {}

try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sales_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER,
      user TEXT,
      action TEXT,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT
    )
  `).run();
} catch {}

[
  ["products", "category", "TEXT"],
  ["products", "price", "REAL"],
  ["products", "stock", "REAL"],
  ["products", "active", "INTEGER DEFAULT 1"],
  ["products", "created_at", "TEXT"],
  ["products", "updated_at", "TEXT"],
  ["sales_budgets", "payment_received", "REAL DEFAULT 0"],
  ["sales_budgets", "discount_total", "REAL DEFAULT 0"],
  ["sales_budgets", "balance", "REAL DEFAULT 0"],
  ["sales_budgets", "sale_number", "TEXT"],
  ["sales_budgets", "converted_at", "TEXT"],
  ["sales_budget_items", "original_price", "REAL"],
  ["sales_budget_items", "discount_percent", "REAL DEFAULT 0"],
  ["sales_budget_items", "discount_amount", "REAL DEFAULT 0"],
  ["sales_budget_items", "final_price", "REAL"],
  ["sales_budget_items", "stock_available", "REAL"],
].forEach(([table, column, type]) => {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  } catch {}
});

try {
  const productCount = db.prepare(`SELECT COUNT(*) AS count FROM products`).get().count;
  if (productCount === 0) {
    const seedProducts = [
      ["AMSO0001", "ABRAZADERA / MANGUERA DIAMETRO 7 AL FRENO", "Repuestos", 500, 50],
      ["AMSO0002", "CAMARA RODADO 26", "Ciclismo", 3200, 18],
      ["AMSO0003", "CUBIERTA RODADO 17", "Ciclismo", 17000, 12],
      ["AMSO0004", "FILTRO ACEITE UNIVERSAL", "Motopartes", 6800, 30],
      ["AMSO0005", "PASTILLA FRENO DELANTERA", "Motopartes", 9200, 22],
      ["AMSO0006", "KIT TRANSMISION BASICO", "Motopartes", 27500, 10],
      ["AMSO0007", "CASCO CICLISMO URBANO", "Ciclismo", 39000, 8],
      ["AMSO0008", "LUZ LED RECARGABLE", "Ciclismo", 12500, 24],
      ["AMSO0009", "BATERIA MOVILIDAD ELECTRICA", "Movilidad Eléctrica", 145000, 5],
      ["AMSO0010", "CARGADOR MOVILIDAD ELECTRICA", "Movilidad Eléctrica", 58000, 7]
    ];
    const stmt = db.prepare(`INSERT INTO products (sku, name, category, price, stock, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`);
    for (const item of seedProducts) stmt.run(...item);
  }
} catch (error) {
  console.error("Error seed products:", error.message);
}
