import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("El servidor devolvió una respuesta inválida. Revisá backend/API.");
  }
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-AR");
  } catch {
    return value;
  }
}

function emptyForm(user) {
  return {
    client: "Cliente mostrador",
    contact_name: "",
    phone: "",
    email: "",
    payment_method: "Efectivo",
    payment_received: 0,
    notes: "",
    created_by: user?.name || "Sistema",
    seller: user?.name || "",
    assigned_to: user?.name || "",
    items: [],
  };
}

function lineTotal(item) {
  const quantity = Number(item.quantity || 0);
  const price = Number(item.original_price || item.price || 0);
  const percent = Number(item.discount_percent || 0);
  const manual = Number(item.discount_amount || 0);
  const discount = Math.max(0, manual + price * quantity * (percent / 100));
  return Math.max(0, price * quantity - discount);
}

export default function SalesBudget({ user }) {
  const [budgets, setBudgets] = useState([]);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [statusFilter, setStatusFilter] = useState("Pendiente");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(() => emptyForm(user));
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const canManage = ["admin", "supervisor", "gerente", "jefe"].includes(user?.role);

  useEffect(() => {
    loadBudgets();
  }, [statusFilter]);

  useEffect(() => {
    const query = productSearch.trim();

    if (query.length < 3) {
      setProductResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const response = await fetch(`${API_URL}/api/products/search?q=${encodeURIComponent(query)}`);
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(data?.error || "No se pudieron buscar productos");
        }

        setProductResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
        setProductResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch]);

  async function loadBudgets() {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (statusFilter !== "Todos") params.append("status", statusFilter);
      if (!canManage) params.append("assigned_to", user?.name || "");

      const response = await fetch(`${API_URL}/api/sales/budgets?${params.toString()}`);
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudieron cargar presupuestos");
      }

      setBudgets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error cargando presupuestos");
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }

  async function openBudget(budget) {
    try {
      const response = await fetch(`${API_URL}/api/sales/budgets/${budget.id}`);
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo abrir el presupuesto");
      }

      const editableItems = (data.items || []).map((item) => ({
        ...item,
        id: item.product_id || item.id,
        name: item.product_name,
        price: item.original_price,
        stock: item.stock_available,
      }));

      setSelectedBudget(data);
      setForm({
        client: data.client || "Cliente mostrador",
        contact_name: data.contact_name || "",
        phone: data.phone || "",
        email: data.email || "",
        payment_method: data.payment_method || "Efectivo",
        payment_received: Number(data.payment_received || 0),
        notes: data.notes || "",
        created_by: user?.name || "Sistema",
        seller: data.seller || user?.name || "",
        assigned_to: data.assigned_to || user?.name || "",
        items: editableItems,
      });
    } catch (error) {
      console.error(error);
      alert(error.message || "Error abriendo presupuesto");
    }
  }

  function addProduct(product) {
    setForm((current) => {
      const existing = current.items.find((item) => String(item.id) === String(product.id));

      if (existing) {
        return {
          ...current,
          items: current.items.map((item) =>
            String(item.id) === String(product.id)
              ? { ...item, quantity: Number(item.quantity || 0) + 1 }
              : item
          ),
        };
      }

      return {
        ...current,
        items: [
          ...current.items,
          {
            id: product.id,
            product_id: product.id,
            sku: product.sku,
            name: product.name,
            product_name: product.name,
            category: product.category,
            quantity: 1,
            original_price: Number(product.price || 0),
            price: Number(product.price || 0),
            discount_percent: 0,
            discount_amount: 0,
            stock_available: Number(product.stock || 0),
            stock: Number(product.stock || 0),
          },
        ],
      };
    });
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => {
      return sum + Number(item.original_price || item.price || 0) * Number(item.quantity || 0);
    }, 0);

    const total = form.items.reduce((sum, item) => sum + lineTotal(item), 0);
    const discount = Math.max(0, subtotal - total);
    const payment = Number(form.payment_received || 0);
    const balance = Math.max(0, total - payment);

    return { subtotal, discount, total, payment, balance };
  }, [form.items, form.payment_received]);

  async function saveBudget(event) {
    event.preventDefault();

    if (form.items.length === 0) {
      alert("Agregá al menos un producto.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        user: user?.name || "Sistema",
        created_by: user?.name || "Sistema",
      };

      const url = selectedBudget
        ? `${API_URL}/api/sales/budgets/${selectedBudget.id}`
        : `${API_URL}/api/sales/budgets`;

      const response = await fetch(url, {
        method: selectedBudget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar el presupuesto");
      }

      alert(selectedBudget ? "Presupuesto actualizado" : "Presupuesto creado");
      setSelectedBudget(data);
      setForm(emptyForm(user));
      setSelectedBudget(null);
      await loadBudgets();
    } catch (error) {
      console.error(error);
      alert(error.message || "Error guardando presupuesto");
    } finally {
      setSaving(false);
    }
  }

  async function convertBudget(budget) {
    if (!confirm("¿Convertir presupuesto a venta? Esta acción descuenta stock.")) return;

    try {
      const response = await fetch(`${API_URL}/api/sales/budgets/${budget.id}/convert`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user?.name || "Sistema" }),
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo convertir a venta");
      }

      alert(`Venta registrada: ${data.sale_number}`);
      await loadBudgets();
    } catch (error) {
      console.error(error);
      alert(error.message || "Error convirtiendo venta");
    }
  }

  async function cancelBudget(budget) {
    if (!confirm("¿Cancelar presupuesto?")) return;

    try {
      const response = await fetch(`${API_URL}/api/sales/budgets/${budget.id}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user?.name || "Sistema" }),
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo cancelar");
      }

      await loadBudgets();
    } catch (error) {
      console.error(error);
      alert(error.message || "Error cancelando presupuesto");
    }
  }

  function resetForm() {
    setSelectedBudget(null);
    setForm(emptyForm(user));
    setProductSearch("");
    setProductResults([]);
  }

  return (
    <section className="module-page sales-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Comercial</p>
          <h1>Presupuestos pendientes</h1>
          <p className="module-subtitle">
            Armá presupuestos editables, aplicá descuentos controlados y convertí a venta cuando corresponda.
          </p>
        </div>

        <div className="header-actions">
          <button className="secondary-button" onClick={loadBudgets}>Actualizar</button>
          <button className="primary-button" onClick={resetForm}>Nuevo presupuesto</button>
        </div>
      </div>

      <div className="sales-layout">
        <div className="table-card sales-form-panel">
          <h3>{selectedBudget ? `Editar presupuesto #${selectedBudget.id}` : "Nuevo presupuesto"}</h3>

          <form className="sales-form" onSubmit={saveBudget}>
            <div className="sales-form-grid">
              <label>
                Cliente
                <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
              </label>

              <label>
                Medio de pago
                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                  <option>Cuenta corriente</option>
                </select>
              </label>

              <label>
                Pago recibido
                <input type="number" value={form.payment_received} onChange={(e) => setForm({ ...form, payment_received: e.target.value })} />
              </label>
            </div>

            <div className="product-search-box">
              <label>
                Buscar producto
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Escribí 3 letras, código o categoría..."
                />
              </label>

              <div className="product-result-grid">
                {searchLoading && <p className="muted">Buscando...</p>}
                {!searchLoading && productSearch.trim().length >= 3 && productResults.length === 0 && (
                  <p className="muted">Sin resultados.</p>
                )}
                {productResults.map((product) => (
                  <button type="button" className="product-card" key={product.id} onClick={() => addProduct(product)}>
                    <strong>{product.sku}</strong>
                    <span>{product.name}</span>
                    <small>Stock: {product.stock} · {formatMoney(product.price)}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="sales-items-list">
              <h4>Productos del presupuesto</h4>

              {form.items.length === 0 ? (
                <p className="muted">Todavía no agregaste productos. El presupuesto no descuenta stock.</p>
              ) : (
                form.items.map((item, index) => (
                  <div className="sales-item-row" key={`${item.sku}-${index}`}>
                    <div className="sales-item-info">
                      <strong>{item.sku}</strong>
                      <span>{item.name || item.product_name}</span>
                      <small>Stock disponible: {item.stock_available ?? item.stock ?? 0}</small>
                    </div>

                    <label>
                      Cant.
                      <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} />
                    </label>

                    <label>
                      Precio
                      <input type="number" value={item.original_price} onChange={(e) => updateItem(index, "original_price", e.target.value)} />
                    </label>

                    <label>
                      Desc. %
                      <input type="number" value={item.discount_percent || 0} onChange={(e) => updateItem(index, "discount_percent", e.target.value)} />
                    </label>

                    <label>
                      Desc. $
                      <input type="number" value={item.discount_amount || 0} onChange={(e) => updateItem(index, "discount_amount", e.target.value)} />
                    </label>

                    <strong className="line-total">{formatMoney(lineTotal(item))}</strong>

                    <button type="button" className="icon-danger-button" onClick={() => removeItem(index)}>×</button>
                  </div>
                ))
              )}
            </div>

            <label>
              Notas
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Condiciones, aclaraciones o motivo del descuento..." />
            </label>

            <div className="sales-total-card">
              <div><span>Subtotal</span><strong>{formatMoney(totals.subtotal)}</strong></div>
              <div><span>Descuento</span><strong>{formatMoney(totals.discount)}</strong></div>
              <div><span>Total final</span><strong>{formatMoney(totals.total)}</strong></div>
              <div><span>Pago recibido</span><strong>{formatMoney(totals.payment)}</strong></div>
              <div><span>Saldo pendiente</span><strong>{formatMoney(totals.balance)}</strong></div>
            </div>

            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={resetForm}>Cancelar</button>
              <button className="primary-button" disabled={saving}>{selectedBudget ? "Guardar cambios" : "Guardar presupuesto"}</button>
            </div>
          </form>
        </div>

        <div className="table-card sales-list-panel">
          <div className="sales-list-header">
            <h3>Bandeja de presupuestos</h3>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>Todos</option>
              <option>Pendiente</option>
              <option>Aprobado</option>
              <option>Convertido</option>
              <option>Cancelado</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-box">Cargando presupuestos...</div>
          ) : budgets.length === 0 ? (
            <div className="empty-box">No hay presupuestos para el filtro seleccionado.</div>
          ) : (
            <div className="sales-budget-list">
              {budgets.map((budget) => (
                <article className="sales-budget-card" key={budget.id}>
                  <div>
                    <strong>#{budget.id} · {budget.client}</strong>
                    <p>{budget.status} · {budget.payment_method} · {formatDate(budget.created_at)}</p>
                  </div>

                  <div className="sales-budget-amounts">
                    <span>Total</span>
                    <strong>{formatMoney(budget.total)}</strong>
                    <small>Saldo: {formatMoney(budget.balance)}</small>
                  </div>

                  <div className="sales-budget-actions">
                    <button className="view-btn" onClick={() => openBudget(budget)}>Editar</button>
                    <button className="primary-mini-button" disabled={budget.status === "Convertido" || budget.status === "Cancelado"} onClick={() => convertBudget(budget)}>Convertir venta</button>
                    <button className="secondary-mini-button" disabled={budget.status === "Convertido" || budget.status === "Cancelado"} onClick={() => cancelBudget(budget)}>Cancelar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
