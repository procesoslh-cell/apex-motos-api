import { useEffect, useMemo, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import ClientCommercialProfile from "./ClientCommercialProfile";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const STAGES = [
  "Prospecto",
  "Primer contacto",
  "Visita / contacto",
  "Entrega información",
  "Negociación",
  "Cierre",
];

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

function getPriorityClass(priority) {
  if (priority === "Alta") return "crm-priority-high";
  if (priority === "Baja") return "crm-priority-low";
  return "crm-priority-medium";
}

function getSlaStatus(opportunity) {
  if (!opportunity?.next_action_date) {
    return {
      label: "Sin fecha",
      className: "sla-gray",
    };
  }

  const today = new Date();
  const due = new Date(opportunity.next_action_date);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diff =
    (due.getTime() - today.getTime()) /
    (1000 * 60 * 60 * 24);

  if (diff < 0) {
    return {
      label: "Vencido",
      className: "sla-red",
    };
  }

  if (diff <= 1) {
    return {
      label: "Por vencer",
      className: "sla-yellow",
    };
  }

  return {
    label: "En tiempo",
    className: "sla-green",
  };
}

export default function CRM({ user }) {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [detail, setDetail] = useState(null);
  const [clientProfileOpportunity, setClientProfileOpportunity] = useState(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activityType, setActivityType] = useState("Llamada");
  const [activityResult, setActivityResult] = useState("");
  const [activityComment, setActivityComment] = useState("");

  const [form, setForm] = useState({
    title: "",
    client: "",
    contact_name: "",
    phone: "",
    email: "",
    segment: "Ciclismo",
    source: "Manual",
    type: "Lead",
    stage: "Prospecto",
    priority: "Media",
    expected_amount: "",
    notes: "",
    next_action_date: "",
    next_action: "",
  });

  useEffect(() => {
    loadOpportunities();
  }, []);

  async function loadOpportunities() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      params.append("role", user?.role || "");
      params.append("name", user?.name || "");

      const response = await fetch(
        `${API_URL}/api/crm/opportunities?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "No se pudieron cargar oportunidades.");
      }

      setOpportunities(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error cargando CRM.");
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(opportunity) {
    try {
      setSelectedOpportunity(opportunity);

      const response = await fetch(
        `${API_URL}/api/crm/opportunities/${opportunity.id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo cargar el detalle.");
      }

      setDetail(data);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error cargando detalle.");
    }
  }

  async function createOpportunity(event) {
    event.preventDefault();

    try {
      setSaving(true);

      const payload = {
        ...form,
        owner: user?.name || "",
        owner_role: user?.role || "",
        assigned_to: user?.name || "",
      };

      const response = await fetch(`${API_URL}/api/crm/opportunities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo crear la oportunidad.");
      }

      setShowNewModal(false);

      setForm({
        title: "",
        client: "",
        contact_name: "",
        phone: "",
        email: "",
        segment: "Ciclismo",
        source: "Manual",
        type: "Lead",
        stage: "Prospecto",
        priority: "Media",
        expected_amount: "",
        notes: "",
        next_action_date: "",
        next_action: "",
      });

      await loadOpportunities();
    } catch (error) {
      console.error(error);
      alert(error.message || "Error creando oportunidad.");
    } finally {
      setSaving(false);
    }
  }

  async function moveStage(opportunity, stage) {
    try {
      const response = await fetch(
        `${API_URL}/api/crm/opportunities/${opportunity.id}/stage`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stage,
            user: user?.name || "",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo cambiar la etapa.");
      }

      setOpportunities((prev) =>
        prev.map((item) => (item.id === opportunity.id ? data : item))
      );

      if (selectedOpportunity?.id === opportunity.id) {
        await loadDetail(data);
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Error cambiando etapa.");
    }
  }

  async function handleDragEnd(result) {
    if (!result.destination) return;

    const sourceStage = result.source.droppableId;
    const destinationStage = result.destination.droppableId;

    if (sourceStage === destinationStage) return;

    const opportunityId = Number(result.draggableId);

    const opportunity = opportunities.find(
      (item) => item.id === opportunityId
    );

    if (!opportunity) return;

    await moveStage(opportunity, destinationStage);
  }

  async function addActivity(event) {
    event.preventDefault();

    if (!detail) return;

    try {
      setSaving(true);

      const response = await fetch(
        `${API_URL}/api/crm/opportunities/${detail.id}/activities`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: activityType,
            result: activityResult,
            comment: activityComment,
            user: user?.name || "",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo registrar actividad.");
      }

      setActivityResult("");
      setActivityComment("");

      await loadDetail(detail);
      await loadOpportunities();
    } catch (error) {
      console.error(error);
      alert(error.message || "Error registrando actividad.");
    } finally {
      setSaving(false);
    }
  }

  async function generateQuote() {
    if (!detail) return;

    try {
      setSaving(true);

      const response = await fetch(
        `${API_URL}/api/crm/opportunities/${detail.id}/generate-quote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            erpType: "Odoo",
            user: user?.name || "",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo generar el presupuesto.");
      }

      alert(`Presupuesto generado: ${data.quoteNumber}`);

      await loadDetail(data.opportunity);
      await loadOpportunities();
    } catch (error) {
      console.error(error);
      alert(error.message || "Error generando presupuesto.");
    } finally {
      setSaving(false);
    }
  }

  const filteredOpportunities = useMemo(() => {
    const value = search.toLowerCase();

    return opportunities.filter((item) => {
      const text = `
        ${item.title || ""}
        ${item.client || ""}
        ${item.contact_name || ""}
        ${item.phone || ""}
        ${item.email || ""}
        ${item.segment || ""}
        ${item.type || ""}
        ${item.stage || ""}
        ${item.assigned_to || ""}
      `.toLowerCase();

      return text.includes(value);
    });
  }, [opportunities, search]);

  const kpis = useMemo(() => {
    return {
      total: filteredOpportunities.length,
      open: filteredOpportunities.filter((item) => item.status !== "Ganada")
        .length,
      negotiation: filteredOpportunities.filter(
        (item) => item.stage === "Negociación"
      ).length,
      amount: filteredOpportunities.reduce(
        (sum, item) => sum + Number(item.expected_amount || 0),
        0
      ),
    };
  }, [filteredOpportunities]);

  function exportCRMCSV() {
    const headers = [
      "ID",
      "Cliente",
      "Contacto",
      "Teléfono",
      "Email",
      "Segmento",
      "Tipo",
      "Etapa",
      "Estado",
      "Responsable",
      "Prioridad",
      "Monto estimado",
      "Próxima acción",
      "Fecha próxima acción",
      "SLA",
      "Origen",
      "Presupuesto ERP",
      "Estado ERP",
      "Creada",
      "Actualizada",
    ];

    const rows = filteredOpportunities.map((item) => [
      item.id,
      item.client,
      item.contact_name,
      item.phone,
      item.email,
      item.segment,
      item.type,
      item.stage,
      item.status,
      item.assigned_to,
      item.priority,
      item.expected_amount,
      item.next_action,
      item.next_action_date,
      getSlaStatus(item).label,
      item.source || item.lead_source || item.channel,
      item.erp_quote_number,
      item.erp_status,
      item.created_at,
      item.updated_at,
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
    link.download = `reporte-crm-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  return (
    <section className="crm-page">
      <div className="module-header crm-header">
        <div>
          <p className="eyebrow">CRM Comercial</p>

          <h1>Oportunidades</h1>

          <p className="module-subtitle">
            Pipeline operativo para leads, recompras, visitas, negociación y
            seguimiento comercial.
          </p>
        </div>

        <div className="crm-header-actions">
          {["admin", "supervisor", "gerente", "jefe"].includes(user?.role) && (
            <button
              className="secondary-button"
              onClick={exportCRMCSV}
              disabled={filteredOpportunities.length === 0}
            >
              Descargar reporte
            </button>
          )}

          <button
            className="primary-button"
            onClick={() => setShowNewModal(true)}
          >
            + Nueva oportunidad
          </button>
        </div>
      </div>

      <div className="crm-kpi-grid">
        <div className="stat-card">
          <span>Oportunidades</span>
          <strong>{kpis.total}</strong>
        </div>

        <div className="stat-card">
          <span>Abiertas</span>
          <strong>{kpis.open}</strong>
        </div>

        <div className="stat-card">
          <span>En negociación</span>
          <strong>{kpis.negotiation}</strong>
        </div>

        <div className="stat-card">
          <span>Monto estimado</span>
          <strong>{formatMoney(kpis.amount)}</strong>
        </div>
      </div>

      <div className="crm-toolbar">
        <input
          className="search-input"
          placeholder="Buscar por cliente, contacto, etapa, segmento o responsable..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <button className="secondary-button" onClick={loadOpportunities}>
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="empty-box">Cargando oportunidades...</div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="crm-kanban">
            {STAGES.map((stage) => {
              const stageItems = filteredOpportunities.filter(
                (item) => item.stage === stage
              );

              return (
                <Droppable droppableId={stage} key={stage}>
                  {(provided) => (
                    <div
                      className="crm-column"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      <div className="crm-column-header">
                        <h3>{stage}</h3>
                        <span>{stageItems.length}</span>
                      </div>

                      <div className="crm-column-body">
                        {stageItems.length === 0 ? (
                          <div className="crm-empty-column">
                            Sin oportunidades
                          </div>
                        ) : (
                          stageItems.map((opportunity, index) => (
                            <Draggable
                              draggableId={String(opportunity.id)}
                              index={index}
                              key={opportunity.id}
                            >
                              {(provided) => (
                                <article
                                  className="crm-card"
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => loadDetail(opportunity)}
                                >
                                  <div className="crm-card-top">
                                    <span className="crm-type">
                                      {opportunity.type}
                                    </span>

                                    <span
                                      className={`crm-priority ${getPriorityClass(
                                        opportunity.priority
                                      )}`}
                                    >
                                      {opportunity.priority}
                                    </span>
                                  </div>

                                  <h4>
                                    {opportunity.title ||
                                      opportunity.client ||
                                      `Oportunidad #${opportunity.id}`}
                                  </h4>

                                  <p>
                                    {opportunity.client ||
                                      "Cliente sin nombre"}
                                  </p>

                                  {opportunity.next_action && (
                                    <div className="crm-next-action">
                                      📌 {opportunity.next_action}
                                    </div>
                                  )}

                                  <div
                                    className={`crm-sla ${
                                      getSlaStatus(opportunity).className
                                    }`}
                                  >
                                    {getSlaStatus(opportunity).label}
                                  </div>

                                  <div className="crm-card-info">
                                    <span>
                                      {opportunity.segment || "Sin segmento"}
                                    </span>

                                    <span>
                                      {formatMoney(
                                        opportunity.expected_amount
                                      )}
                                    </span>
                                  </div>

                                  <div className="crm-card-footer">
                                    <span>
                                      {opportunity.assigned_to ||
                                        "Sin asignar"}
                                    </span>

                                    <span>
                                      {formatDate(
                                        opportunity.next_action_date
                                      )}
                                    </span>
                                  </div>
                                </article>
                              )}
                            </Draggable>
                          ))
                        )}

                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {showNewModal && (
        <div className="modal-overlay">
          <div className="modal crm-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Nueva oportunidad</p>
                <h2>Crear oportunidad CRM</h2>
                <p>Cargá un lead, recompra o cliente inactivo.</p>
              </div>

              <button onClick={() => setShowNewModal(false)}>×</button>
            </div>

            <form className="form-grid" onSubmit={createOpportunity}>
              <label>
                Título
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="Ej: Recompra cliente mayorista"
                />
              </label>

              <label>
                Cliente
                <input
                  value={form.client}
                  onChange={(event) =>
                    setForm({ ...form, client: event.target.value })
                  }
                  placeholder="Nombre del cliente"
                  required
                />
              </label>

              <label>
                Contacto
                <input
                  value={form.contact_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      contact_name: event.target.value,
                    })
                  }
                  placeholder="Persona de contacto"
                />
              </label>

              <label>
                Teléfono / WhatsApp
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="Teléfono"
                />
              </label>

              <label>
                Email
                <input
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="Email"
                />
              </label>

              <label>
                Segmento
                <select
                  value={form.segment}
                  onChange={(event) =>
                    setForm({ ...form, segment: event.target.value })
                  }
                >
                  <option>Ciclismo</option>
                  <option>Motopartes</option>
                  <option>Movilidad Eléctrica</option>
                  <option>Autopartes</option>
                  <option>Otro</option>
                </select>
              </label>

              <label>
                Tipo
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value })
                  }
                >
                  <option>Lead</option>
                  <option>Recompra</option>
                  <option>Inactivo</option>
                  <option>DTC</option>
                </select>
              </label>

              <label>
                Etapa inicial
                <select
                  value={form.stage}
                  onChange={(event) =>
                    setForm({ ...form, stage: event.target.value })
                  }
                >
                  {STAGES.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </label>

              <label>
                Prioridad
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm({ ...form, priority: event.target.value })
                  }
                >
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Baja</option>
                </select>
              </label>

              <label>
                Monto estimado
                <input
                  type="number"
                  value={form.expected_amount}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      expected_amount: event.target.value,
                    })
                  }
                  placeholder="0"
                />
              </label>

              <label>
                Próxima acción
                <input
                  type="date"
                  value={form.next_action_date}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      next_action_date: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Acción pendiente
                <input
                  value={form.next_action}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      next_action: event.target.value,
                    })
                  }
                  placeholder="Ej: Llamar cliente"
                />
              </label>

              <label className="full">
                Observaciones
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Detalle inicial de la oportunidad..."
                />
              </label>

              <div className="modal-footer full">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancelar
                </button>

                <button className="primary-button" disabled={saving}>
                  Crear oportunidad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedOpportunity && detail && (
        <div className="modal-overlay">
          <div className="modal detail-modal crm-detail-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Detalle oportunidad</p>

                <h2>
                  {detail.title || detail.client || `Oportunidad #${detail.id}`}
                </h2>

                <p>
                  {detail.client || "Cliente sin nombre"} ·{" "}
                  {detail.stage || "Sin etapa"}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedOpportunity(null);
                  setDetail(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="request-top-grid">
              <div className="request-main-info">
                <div className="crm-stage-actions">
                  {STAGES.map((stage) => (
                    <button
                      key={stage}
                      className={
                        detail.stage === stage
                          ? "crm-stage-button active"
                          : "crm-stage-button"
                      }
                      onClick={() => moveStage(detail, stage)}
                    >
                      {stage}
                    </button>
                  ))}
                </div>

                <div className="detail-section">
                  <h3>Información principal</h3>

                  <div className="detail-grid">
                    <div className="detail-box">
                      <strong>Cliente</strong>
                      <p>{detail.client || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Contacto</strong>
                      <p>{detail.contact_name || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Teléfono</strong>
                      <p>{detail.phone || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Email</strong>
                      <p>{detail.email || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Segmento</strong>
                      <p>{detail.segment || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Tipo</strong>
                      <p>{detail.type || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Responsable</strong>
                      <p>{detail.assigned_to || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Monto estimado</strong>
                      <p>{formatMoney(detail.expected_amount)}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Próxima acción</strong>
                      <p>{detail.next_action || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Fecha próxima acción</strong>
                      <p>{formatDate(detail.next_action_date)}</p>
                    </div>

                    <div className="detail-box full">
                      <strong>Observaciones</strong>
                      <p>{detail.notes || "Sin observaciones"}</p>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Registrar actividad</h3>

                  <form className="crm-activity-form" onSubmit={addActivity}>
                    <select
                      value={activityType}
                      onChange={(event) => setActivityType(event.target.value)}
                    >
                      <option>Llamada</option>
                      <option>WhatsApp</option>
                      <option>Visita</option>
                      <option>Reunión</option>
                      <option>Nota</option>
                    </select>

                    <select
                      value={activityResult}
                      onChange={(event) =>
                        setActivityResult(event.target.value)
                      }
                    >
                      <option value="">Resultado</option>
                      <option>Llamada 1 sin contacto</option>
                      <option>Llamada 2 sin contacto</option>
                      <option>Llamada 3 sin contacto</option>
                      <option>No atiende</option>
                      <option>Contacto efectivo</option>
                      <option>Visita agendada</option>
                      <option>Visita sin pedido</option>
                      <option>Visita no asistida</option>
                      <option>Presupuesto generado</option>
                      <option>Pedido confirmado</option>
                    </select>

                    <textarea
                      value={activityComment}
                      onChange={(event) =>
                        setActivityComment(event.target.value)
                      }
                      placeholder="Comentario de la actividad..."
                    />

                    <button className="primary-button" disabled={saving}>
                      Registrar actividad
                    </button>
                  </form>
                </div>
              </div>

              <div className="request-side-panel">
                <div className="side-card client-profile-card">
                  <h3>Perfil comercial</h3>

                  <div className="collection-summary-list">
                    <div>
                      <span>Cliente Odoo</span>
                      <strong>{detail.odoo_cliente_id || "Sin vincular"}</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() => setClientProfileOpportunity(detail)}
                    disabled={!detail.odoo_cliente_id}
                    style={{ width: "100%", marginTop: "16px" }}
                  >
                    Ver perfil comercial
                  </button>

                  <p className="collection-helper">
                    Permite consultar historial, categorías, deuda y oportunidades
                    antes de contactar al cliente.
                  </p>
                </div>

                <div className="side-card erp-card">
                  <h3>Integración ERP</h3>

                  <div className="collection-summary-list">
                    <div>
                      <span>Estado</span>
                      <strong>{detail.erp_status || "Sin sincronizar"}</strong>
                    </div>

                    <div>
                      <span>Presupuesto</span>
                      <strong>{detail.erp_quote_number || "-"}</strong>
                    </div>
                  </div>

                  <button
                    className="primary-button"
                    onClick={generateQuote}
                    disabled={saving}
                    style={{
                      width: "100%",
                      marginTop: "16px",
                    }}
                  >
                    Generar presupuesto
                  </button>

                  <p className="collection-helper">
                    Actualmente genera un presupuesto mock. La capa queda
                    preparada para Odoo o NetSuite.
                  </p>
                </div>

                <div className="side-card">
                  <h3>Resumen</h3>

                  <div className="collection-summary-list">
                    <div>
                      <span>Etapa</span>
                      <strong>{detail.stage}</strong>
                    </div>

                    <div>
                      <span>Prioridad</span>
                      <strong>{detail.priority}</strong>
                    </div>

                    <div>
                      <span>SLA</span>
                      <strong>{getSlaStatus(detail).label}</strong>
                    </div>

                    <div>
                      <span>Próxima acción</span>
                      <strong>{formatDate(detail.next_action_date)}</strong>
                    </div>

                    <div>
                      <span>Creada</span>
                      <strong>{formatDate(detail.created_at)}</strong>
                    </div>

                    <div>
                      <span>Actualizada</span>
                      <strong>{formatDate(detail.updated_at)}</strong>
                    </div>
                  </div>
                </div>

                <div className="side-card">
                  <h3>Historial de actividades</h3>

                  <div className="timeline-list">
                    {detail.activities?.length > 0 ? (
                      detail.activities.map((activity) => (
                        <div className="timeline-item" key={activity.id}>
                          <strong>
                            {activity.type}{" "}
                            {activity.result ? `· ${activity.result}` : ""}
                          </strong>

                          <p>{activity.comment || "Sin comentario"}</p>

                          <span>
                            {activity.user || "Usuario"} ·{" "}
                            {formatDate(activity.created_at)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="empty-box">Sin actividades.</div>
                    )}
                  </div>
                </div>

                <div className="side-card">
                  <h3>Cambios de etapa</h3>

                  <div className="timeline-list">
                    {detail.history?.length > 0 ? (
                      detail.history.map((item) => (
                        <div className="timeline-item" key={item.id}>
                          <strong>
                            {item.from_stage || "-"} → {item.to_stage || "-"}
                          </strong>

                          <p>{item.user || "Sistema"}</p>

                          <span>{formatDate(item.created_at)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty-box">
                        Sin cambios registrados.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {clientProfileOpportunity && (
        <ClientCommercialProfile
          client={{
            cliente: clientProfileOpportunity.client,
            cliente_id: clientProfileOpportunity.odoo_cliente_id,
            asesor: clientProfileOpportunity.assigned_to,
          }}
          clienteId={clientProfileOpportunity.odoo_cliente_id}
          onClose={() => setClientProfileOpportunity(null)}
        />
      )}
    </section>
  );
}