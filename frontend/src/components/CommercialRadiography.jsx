import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

async function readJsonResponse(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      "El servidor devolvió una respuesta inválida. Revisá backend/API."
    );
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
    return new Date(value).toLocaleDateString("es-AR");
  } catch {
    return value;
  }
}

function getMonthsWithoutSales(row, months) {
  if (!row?.months || !Array.isArray(months) || months.length === 0) return null;

  let count = 0;

  for (let i = months.length - 1; i >= 0; i -= 1) {
    if (row.months[months[i]]) break;
    count += 1;
  }

  return count;
}

export default function CommercialRadiography({ user }) {
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState([]);
  const [data, setData] = useState([]);
  const [asesores, setAsesores] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedAsesor, setSelectedAsesor] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileClient, setProfileClient] = useState(null);
  const [clientProfile, setClientProfile] = useState(null);

  const [leadModalClient, setLeadModalClient] = useState(null);
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadForm, setLeadForm] = useState({
    assigned_to: "",
    next_action: "Llamar cliente",
    reason: "Cliente inactivo detectado desde radiografía comercial.",
    priority: "Alta",
  });

  const isSeller = user?.role === "vendedor";
  const canAssignLeads = ["admin", "supervisor", "gerente", "jefe"].includes(
    user?.role
  );

  useEffect(() => {
    loadUsers();

    if (isSeller) {
      loadData();
    } else {
      loadAsesores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers() {
    try {
      const response = await fetch(`${API_URL}/api/users`);
      const json = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(json?.error || "No se pudieron cargar usuarios.");
      }

      setUsers(Array.isArray(json) ? json : []);
    } catch (error) {
      console.error(error);
      setUsers([]);
    }
  }

  async function loadAsesores() {
    try {
      setError("");

      const response = await fetch(`${API_URL}/api/odoo/asesores`);
      const json = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(json?.error || "No se pudieron cargar los asesores.");
      }

      setAsesores(Array.isArray(json) ? json : []);
    } catch (error) {
      console.error(error);
      setAsesores([]);
      setError(error.message || "No se pudieron cargar los asesores.");
    }
  }

  async function loadData() {
    if (!isSeller && !selectedAsesor) {
      setError("Seleccioná un asesor para cargar la radiografía.");
      setData([]);
      setMonths([]);
      return;
    }

    if (isSeller && !user?.odoo_user_id) {
      setError("Tu usuario no tiene vendedor Odoo vinculado.");
      setData([]);
      setMonths([]);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.append("role", user?.role || "");

      if (isSeller) {
        params.append("odooUserId", user.odoo_user_id);
      } else {
        params.append("asesorId", selectedAsesor);
      }

      const response = await fetch(
        `${API_URL}/api/comercial/radiografia?${params.toString()}`
      );
      const json = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          json?.error || "No se pudo cargar la radiografía. Revisá Odoo."
        );
      }

      setMonths(Array.isArray(json?.months) ? json.months : []);
      setData(Array.isArray(json?.data) ? json.data : []);
    } catch (error) {
      console.error(error);
      setMonths([]);
      setData([]);
      setError(error.message || "Error cargando radiografía.");
    } finally {
      setLoading(false);
    }
  }

  async function openClientProfile(client) {
    try {
      setProfileClient(client);
      setClientProfile(null);
      setProfileLoading(true);

      const response = await fetch(
        `${API_URL}/api/comercial/clientes/${client.cliente_id}/perfil`
      );
      const json = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(json?.error || "No se pudo cargar el perfil comercial.");
      }

      setClientProfile(json);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error cargando perfil comercial.");
    } finally {
      setProfileLoading(false);
    }
  }

  function openLeadModal(client) {
    const monthsWithoutSales = getMonthsWithoutSales(client, safeMonths);

    setLeadModalClient(client);
    setLeadForm({
      assigned_to: client.asesor || "",
      next_action: "Llamar cliente",
      reason:
        monthsWithoutSales !== null
          ? `Cliente con ${monthsWithoutSales} meses sin compra. Reactivación desde radiografía comercial.`
          : "Cliente inactivo detectado desde radiografía comercial.",
      priority: client.estado === "Inactivo" ? "Alta" : "Media",
    });
  }

  async function assignLead(event) {
    event.preventDefault();

    if (!leadModalClient) return;

    try {
      setLeadSaving(true);

      const response = await fetch(
        `${API_URL}/api/comercial/clientes/${leadModalClient.cliente_id}/asignar-lead`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cliente: leadModalClient.cliente,
            segment: leadModalClient.segment || "General",
            assigned_to: leadForm.assigned_to,
            next_action: leadForm.next_action,
            reason: leadForm.reason,
            priority: leadForm.priority,
            user: user?.name || "Sistema",
            user_role: user?.role || "supervisor",
          }),
        }
      );

      const json = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(json?.error || "No se pudo asignar el lead.");
      }

      alert(`Lead creado en CRM: #${json.id}`);
      setLeadModalClient(null);

      if (profileClient?.cliente_id === leadModalClient.cliente_id) {
        await openClientProfile(leadModalClient);
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Error asignando lead.");
    } finally {
      setLeadSaving(false);
    }
  }

  function formatMonth(monthKey) {
    if (!monthKey || typeof monthKey !== "string") return "-";

    const [year, month] = monthKey.split("-");
    const monthIndex = Number(month) - 1;

    return `${MONTH_NAMES[monthIndex] || month} ${String(year).slice(2)}`;
  }

  const safeData = Array.isArray(data) ? data : [];
  const safeMonths = Array.isArray(months) ? months : [];
  const safeAsesores = Array.isArray(asesores) ? asesores : [];

  const assignableUsers = useMemo(() => {
    return users.filter((item) =>
      ["vendedor", "supervisor", "admin"].includes(item.role)
    );
  }, [users]);

  const filteredData = useMemo(() => {
    const value = search.toLowerCase();

    return safeData.filter((item) => {
      return (
        (item.cliente || "").toLowerCase().includes(value) ||
        (item.asesor || "").toLowerCase().includes(value) ||
        (item.estado || "").toLowerCase().includes(value)
      );
    });
  }, [safeData, search]);

  const totalClientes = safeData.length;
  const totalActivos = safeData.filter((item) => item.estado === "Activo").length;
  const totalInactivos = safeData.filter(
    (item) => item.estado === "Inactivo"
  ).length;

  const clientesSinCompra3M = safeData.filter((item) => {
    const monthsWithoutSales = getMonthsWithoutSales(item, safeMonths);
    return monthsWithoutSales !== null && monthsWithoutSales >= 3;
  }).length;

  function exportCSV() {
    const headers = [
      "Cliente",
      "Asesor",
      ...safeMonths.map(formatMonth),
      "Estado",
      "Meses sin compra",
      "Total 12M",
    ];

    const rows = filteredData.map((row) => [
      row.cliente,
      row.asesor,
      ...safeMonths.map((month) => (row.months?.[month] ? "SI" : "NO")),
      row.estado,
      getMonthsWithoutSales(row, safeMonths),
      row.totalFacturas12m,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(";")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `radiografia-comercial-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  return (
    <div className="radiography-page">
      <div className="radiography-header">
        <div>
          <h1>Radiografía Comercial</h1>

          <p>
            {isSeller
              ? "Tu cartera con historial comercial, actividad, inactividad y perfil por cliente."
              : "Cartera por asesor con historial, perfil comercial y generación de leads de reactivación."}
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={exportCSV}
          disabled={filteredData.length === 0}
        >
          Descargar CSV
        </button>
      </div>

      <div className="radiography-filters">
        {!isSeller && (
          <>
            <select
              className="status-filter"
              value={selectedAsesor}
              onChange={(event) => {
                setSelectedAsesor(event.target.value);
                setData([]);
                setMonths([]);
                setError("");
              }}
            >
              <option value="">Seleccionar asesor</option>

              {safeAsesores.map((asesor) => (
                <option key={asesor.asesor_id} value={asesor.asesor_id}>
                  {asesor.asesor}
                </option>
              ))}
            </select>

            <button className="primary-button" onClick={loadData}>
              Cargar radiografía
            </button>
          </>
        )}

        {isSeller && (
          <button className="primary-button" onClick={loadData}>
            Actualizar mi radiografía
          </button>
        )}

        <input
          className="search-input"
          type="text"
          placeholder="Buscar cliente, asesor o estado..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error && <div className="radiography-error">{error}</div>}

      <div className="radiography-stats radiography-stats-extended">
        <div className="stat-card">
          <span>Total cartera</span>
          <strong>{totalClientes}</strong>
        </div>

        <div className="stat-card">
          <span>Clientes activos</span>
          <strong>{totalActivos}</strong>
        </div>

        <div className="stat-card">
          <span>Clientes inactivos</span>
          <strong>{totalInactivos}</strong>
        </div>

        <div className="stat-card">
          <span>Sin compra +3M</span>
          <strong>{clientesSinCompra3M}</strong>
        </div>
      </div>

      <div className="radiography-table-wrapper">
        <table className="radiography-table radiography-table-actions">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Asesor</th>

              {safeMonths.map((month) => (
                <th key={month}>{formatMonth(month)}</th>
              ))}

              <th>Estado</th>
              <th>Sin compra</th>
              <th>12M</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={safeMonths.length + 6}>Cargando radiografía...</td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={safeMonths.length + 6}>
                  {error
                    ? "No se pudo cargar la información comercial."
                    : isSeller
                    ? "No hay datos para tu cartera o tu usuario no tiene vendedor Odoo vinculado."
                    : "Seleccioná un asesor y presioná “Cargar radiografía”."}
                </td>
              </tr>
            ) : (
              filteredData.map((item) => {
                const monthsWithoutSales = getMonthsWithoutSales(item, safeMonths);
                const canReactivate = monthsWithoutSales !== null && monthsWithoutSales >= 3;

                return (
                  <tr key={item.cliente_id || item.cliente}>
                    <td>
                      <div className="radiography-client-cell">
                        <strong>{item.cliente || "-"}</strong>
                        <span>ID Odoo: {item.cliente_id || "-"}</span>
                      </div>
                    </td>

                    <td>{item.asesor || "-"}</td>

                    {safeMonths.map((month) => (
                      <td key={month} className="month-cell">
                        {item.months?.[month] ? "✅" : "❌"}
                      </td>
                    ))}

                    <td>
                      <span
                        className={
                          item.estado === "Activo"
                            ? "status-active"
                            : "status-inactive"
                        }
                      >
                        {item.estado || "Sin estado"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          canReactivate
                            ? "radiography-risk-pill high"
                            : "radiography-risk-pill"
                        }
                      >
                        {monthsWithoutSales ?? "-"} meses
                      </span>
                    </td>

                    <td>{item.totalFacturas12m || 0}</td>

                    <td>
                      <div className="radiography-actions">
                        <button
                          className="view-btn"
                          onClick={() => openClientProfile(item)}
                        >
                          Ver perfil
                        </button>

                        {canAssignLeads && (
                          <button
                            className={
                              canReactivate
                                ? "primary-mini-button"
                                : "secondary-mini-button"
                            }
                            onClick={() => openLeadModal(item)}
                          >
                            Asignar lead
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {profileClient && (
        <div className="modal-overlay">
          <div className="modal detail-modal client-profile-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Perfil comercial</p>
                <h2>{profileClient.cliente}</h2>
                <p>
                  Historial, categorías, deuda, presupuestos y oportunidades CRM
                  vinculadas.
                </p>
              </div>

              <button
                onClick={() => {
                  setProfileClient(null);
                  setClientProfile(null);
                }}
              >
                ×
              </button>
            </div>

            {profileLoading ? (
              <div className="empty-box">Cargando perfil comercial...</div>
            ) : (
              <div className="request-top-grid">
                <div className="request-main-info">
                  <div className="detail-section">
                    <h3>Resumen comercial</h3>

                    <div className="detail-grid">
                      <div className="detail-box">
                        <strong>Cliente</strong>
                        <p>{clientProfile?.cliente?.cliente || profileClient.cliente}</p>
                      </div>

                      <div className="detail-box">
                        <strong>Asesor</strong>
                        <p>{clientProfile?.cliente?.asesor || profileClient.asesor || "-"}</p>
                      </div>

                      <div className="detail-box">
                        <strong>Total 12M</strong>
                        <p>{formatMoney(clientProfile?.resumen?.total12m)}</p>
                      </div>

                      <div className="detail-box">
                        <strong>Categoría principal</strong>
                        <p>{clientProfile?.resumen?.categoriaPrincipal || "-"}</p>
                      </div>

                      <div className="detail-box">
                        <strong>Condición de pago</strong>
                        <p>{clientProfile?.resumen?.condicionPago || "-"}</p>
                      </div>

                      <div className="detail-box">
                        <strong>Deuda pendiente</strong>
                        <p>{formatMoney(clientProfile?.resumen?.deudaPendiente)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Compras por categoría</h3>

                    <div className="profile-table-wrapper">
                      <table className="profile-table">
                        <thead>
                          <tr>
                            <th>Categoría</th>
                            <th>Facturas</th>
                            <th>Unidades</th>
                            <th>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(clientProfile?.categorias || []).length === 0 ? (
                            <tr>
                              <td colSpan="4">Sin datos de categorías.</td>
                            </tr>
                          ) : (
                            clientProfile.categorias.map((item) => (
                              <tr key={item.categoria}>
                                <td>{item.categoria}</td>
                                <td>{item.facturas || 0}</td>
                                <td>{Number(item.unidades || 0).toLocaleString("es-AR")}</td>
                                <td>{formatMoney(item.monto)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Últimas compras</h3>

                    <div className="profile-table-wrapper">
                      <table className="profile-table">
                        <thead>
                          <tr>
                            <th>Factura</th>
                            <th>Fecha</th>
                            <th>Monto</th>
                            <th>Pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(clientProfile?.ultimasCompras || []).length === 0 ? (
                            <tr>
                              <td colSpan="4">Sin compras recientes.</td>
                            </tr>
                          ) : (
                            clientProfile.ultimasCompras.map((item) => (
                              <tr key={item.factura_id || item.factura}>
                                <td>{item.factura}</td>
                                <td>{formatDate(item.fecha)}</td>
                                <td>{formatMoney(item.monto)}</td>
                                <td>{item.payment_state || "-"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="request-side-panel">
                  <div className="side-card">
                    <h3>Acciones comerciales</h3>

                    <button
                      className="primary-button"
                      style={{ width: "100%" }}
                      onClick={() => openLeadModal(profileClient)}
                    >
                      Asignar lead de reactivación
                    </button>

                    <p className="collection-helper">
                      El lead se crea automáticamente en el CRM para seguimiento
                      del vendedor o del Centro de Contacto.
                    </p>
                  </div>

                  <div className="side-card">
                    <h3>Oportunidades CRM</h3>

                    <div className="timeline-list">
                      {(clientProfile?.oportunidades || []).length === 0 ? (
                        <div className="empty-box">Sin oportunidades CRM.</div>
                      ) : (
                        clientProfile.oportunidades.map((item) => (
                          <div className="timeline-item" key={item.id}>
                            <strong>#{item.id} · {item.type}</strong>
                            <p>{item.stage} · {item.assigned_to || "Sin asignar"}</p>
                            <span>{formatDate(item.created_at)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="side-card">
                    <h3>Presupuestos recientes</h3>

                    <div className="timeline-list">
                      {(clientProfile?.presupuestos || []).length === 0 ? (
                        <div className="empty-box">Sin presupuestos recientes.</div>
                      ) : (
                        clientProfile.presupuestos.map((item) => (
                          <div className="timeline-item" key={item.presupuesto_id}>
                            <strong>{item.presupuesto}</strong>
                            <p>{formatMoney(item.monto)} · {item.state}</p>
                            <span>{formatDate(item.fecha)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {leadModalClient && (
        <div className="modal-overlay">
          <div className="modal small-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Asignar lead</p>
                <h2>{leadModalClient.cliente}</h2>
                <p>Creá una oportunidad CRM para contactar al cliente.</p>
              </div>

              <button onClick={() => setLeadModalClient(null)}>×</button>
            </div>

            <form className="form-grid" onSubmit={assignLead}>
              <label>
                Asignar a
                <select
                  value={leadForm.assigned_to}
                  onChange={(event) =>
                    setLeadForm({ ...leadForm, assigned_to: event.target.value })
                  }
                  required
                >
                  <option value="">Seleccionar responsable</option>

                  {assignableUsers.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name} · {item.role}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Prioridad
                <select
                  value={leadForm.priority}
                  onChange={(event) =>
                    setLeadForm({ ...leadForm, priority: event.target.value })
                  }
                >
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Baja</option>
                </select>
              </label>

              <label className="full">
                Próxima acción
                <input
                  value={leadForm.next_action}
                  onChange={(event) =>
                    setLeadForm({ ...leadForm, next_action: event.target.value })
                  }
                />
              </label>

              <label className="full">
                Motivo / observación
                <textarea
                  value={leadForm.reason}
                  onChange={(event) =>
                    setLeadForm({ ...leadForm, reason: event.target.value })
                  }
                />
              </label>

              <div className="modal-footer full">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setLeadModalClient(null)}
                >
                  Cancelar
                </button>

                <button className="primary-button" disabled={leadSaving}>
                  Crear lead CRM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
