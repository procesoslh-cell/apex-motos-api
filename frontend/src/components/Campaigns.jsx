import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function readJsonResponse(res) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      "El servidor devolvió una respuesta inválida. Revisá si la ruta existe y si el backend está levantado."
    );
  }
}

function parseClients(text, assignedTo, segment) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [cliente, phone = "", email = ""] = line
        .split(";")
        .map((x) => x.trim());

      return {
        cliente,
        phone,
        email,
        assigned_to: assignedTo,
        segment,
      };
    });
}

export default function Campaigns({ user }) {
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clientText, setClientText] = useState("");

  const [form, setForm] = useState({
    name: "Reactivación cartera",
    type: "Reactivación",
    segment: "Ciclismo",
    assigned_to: "",
    notes: "Clientes inactivos para recuperar durante semanas sin gira.",
  });

  useEffect(() => {
    loadCampaigns();
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await fetch(`${API_URL}/api/users`);
      const data = await readJsonResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar usuarios");
      }

      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setUsers([]);
    }
  }

  async function loadCampaigns() {
    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/crm/campaigns`);
      const data = await readJsonResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar campañas");
      }

      setCampaigns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error cargando campañas");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(campaign) {
    try {
      setSelected(campaign);

      const res = await fetch(`${API_URL}/api/crm/campaigns/${campaign.id}`);
      const data = await readJsonResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo cargar detalle");
      }

      setDetail(data);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error cargando campaña");
    }
  }

  async function createCampaign(event) {
    event.preventDefault();

    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          owner: user?.name || "",
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear campaña");
      }

      await loadCampaigns();
      await loadDetail(data);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error creando campaña");
    }
  }

  async function addClients() {
    if (!detail) return;

    const clients = parseClients(clientText, detail.assigned_to, detail.segment);

    if (clients.length === 0) {
      alert("Pegá al menos un cliente. Formato: Cliente;telefono;email");
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/crm/campaigns/${detail.id}/clients`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clients,
            assigned_to: detail.assigned_to,
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron agregar clientes");
      }

      setClientText("");

      await loadCampaigns();
      await loadDetail(detail);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error agregando clientes");
    }
  }

  async function generateLeads() {
    if (!detail) return;

    try {
      const res = await fetch(
        `${API_URL}/api/crm/campaigns/${detail.id}/generate-leads`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user: user?.name || "Sistema",
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron generar leads");
      }

      alert(`Leads generados: ${data.generated}`);

      await loadCampaigns();
      await loadDetail(detail);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error generando leads");
    }
  }

  const sellers = useMemo(() => {
    return users.filter((item) =>
      ["vendedor", "supervisor", "admin"].includes(item.role)
    );
  }, [users]);

  return (
    <section className="module-page campaigns-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">CRM Comercial</p>

          <h1>Campañas y asignación</h1>

          <p className="module-subtitle">
            Asigná clientes inactivos o campañas de recompra para que aparezcan
            como leads en el CRM.
          </p>
        </div>

        <button className="secondary-button" onClick={loadCampaigns}>
          Actualizar
        </button>
      </div>

      <div className="campaign-layout">
        <div className="table-card campaign-panel">
          <h3>Nueva campaña</h3>

          <form className="campaign-form" onSubmit={createCampaign}>
            <label>
              Nombre
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Tipo
              <select
                value={form.type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    type: event.target.value,
                  })
                }
              >
                <option>Reactivación</option>
                <option>Recompra</option>
                <option>Prospección</option>
                <option>Lanzamiento</option>
              </select>
            </label>

            <label>
              Segmento
              <select
                value={form.segment}
                onChange={(event) =>
                  setForm({
                    ...form,
                    segment: event.target.value,
                  })
                }
              >
                <option>Ciclismo</option>
                <option>Motopartes</option>
                <option>Movilidad Eléctrica</option>
                <option>Autopartes</option>
                <option>General</option>
              </select>
            </label>

            <label>
              Asignar a
              <select
                value={form.assigned_to}
                onChange={(event) =>
                  setForm({
                    ...form,
                    assigned_to: event.target.value,
                  })
                }
              >
                <option value="">Cola sin asignar</option>

                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.name}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="full">
              Notas
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({
                    ...form,
                    notes: event.target.value,
                  })
                }
              />
            </label>

            <button className="primary-button">Crear campaña</button>
          </form>
        </div>

        <div className="table-card campaign-panel">
          <h3>Campañas activas</h3>

          {loading ? (
            <p>Cargando...</p>
          ) : campaigns.length === 0 ? (
            <p className="muted">No hay campañas.</p>
          ) : (
            <div className="campaign-list">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  className={
                    selected?.id === campaign.id
                      ? "campaign-row active"
                      : "campaign-row"
                  }
                  onClick={() => loadDetail(campaign)}
                >
                  <strong>{campaign.name}</strong>

                  <span>
                    {campaign.type} · {campaign.segment}
                  </span>

                  <small>
                    {campaign.clients_count || 0} clientes ·{" "}
                    {campaign.leads_generated || 0} leads
                  </small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div className="table-card campaign-detail-card">
          <div className="module-header compact-header">
            <div>
              <p className="eyebrow">Detalle campaña</p>

              <h2>{detail.name}</h2>

              <p className="module-subtitle">
                {detail.type} · {detail.segment} · Responsable:{" "}
                {detail.assigned_to || "Sin asignar"}
              </p>
            </div>

            <button className="primary-button" onClick={generateLeads}>
              Generar leads CRM
            </button>
          </div>

          <div className="campaign-import-grid">
            <div>
              <h3>Agregar clientes</h3>

              <p className="muted">
                Pegá uno por línea: Cliente;telefono;email
              </p>

              <textarea
                className="campaign-client-import"
                value={clientText}
                onChange={(event) => setClientText(event.target.value)}
                placeholder={
                  "Cliente A;11223344;cliente@mail.com\nCliente B;11556677;"
                }
              />

              <button className="secondary-button" onClick={addClients}>
                Agregar a campaña
              </button>
            </div>

            <div>
              <h3>Clientes asignados</h3>

              <div className="campaign-client-list">
                {(detail.clients || []).length === 0 ? (
                  <p className="muted">Todavía no hay clientes.</p>
                ) : (
                  detail.clients.map((client) => (
                    <div className="campaign-client-item" key={client.id}>
                      <strong>{client.cliente}</strong>

                      <span>
                        {client.assigned_to || "Sin asignar"} · {client.status}
                      </span>

                      {client.lead_opportunity_id && (
                        <small>Lead #{client.lead_opportunity_id}</small>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
