import { useEffect, useMemo, useState } from "react";
import CollectionDetail from "./CollectionDetail";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getStatusLabel(status) {
  switch (status) {
    case "Validada":
    case "validated":
    case "approved":
      return "Validada";
    case "Observada":
    case "observed":
      return "Observada";
    case "Rechazada":
    case "rejected":
      return "Rechazada";
    case "Pendiente validación":
    case "pending":
    default:
      return "Pendiente";
  }
}

function getStatusClass(status) {
  switch (status) {
    case "Validada":
    case "validated":
    case "approved":
      return "status-approved";
    case "Observada":
    case "observed":
      return "status-warning-badge";
    case "Rechazada":
    case "rejected":
      return "status-rejected";
    case "Pendiente validación":
    case "pending":
    default:
      return "status-pending";
  }
}

export default function Collections({ currentUser }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    cliente: "",
    total: "",
    payment_method: "Transferencia",
    notes: "",
  });

  async function loadCollections() {
    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/collections`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error al cargar cobranzas");
      }

      setCollections(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      alert("No se pudieron cargar las cobranzas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCollections();
  }, []);

  const filteredCollections = useMemo(() => {
    let result = [...collections];

    if (currentUser?.role === "vendedor") {
      result = result.filter((item) => {
        const asesor = item.asesor || item.seller || item.created_by || "";

        return (
          asesor === currentUser?.name ||
          asesor === currentUser?.username ||
          asesor === currentUser?.email
        );
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter);
    }

    if (search.trim()) {
      const value = search.toLowerCase();

      result = result.filter((item) =>
        `
          ${item.id}
          ${item.cliente || ""}
          ${item.client || ""}
          ${item.asesor || ""}
          ${item.receipt_number || ""}
          ${item.payment_method || ""}
          ${item.status || ""}
          ${item.observation_reason || ""}
        `
          .toLowerCase()
          .includes(value)
      );
    }

    return result;
  }, [collections, currentUser, statusFilter, search]);

  async function handleRefresh() {
    await loadCollections();
    setSelectedCollection(null);
  }


  async function createCollection(event) {
    event.preventDefault();

    try {
      const payload = {
        cliente_id: null,
        cliente: createForm.cliente,
        asesor_id: currentUser?.odoo_user_id || null,
        asesor: currentUser?.name || currentUser?.username || "",
        total: Number(createForm.total || 0),
        payment_method: createForm.payment_method,
        notes: createForm.notes,
        items: [],
      };

      const res = await fetch(`${API_URL}/api/collections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear la cobranza");
      }

      setShowCreateModal(false);
      setCreateForm({
        cliente: "",
        total: "",
        payment_method: "Transferencia",
        notes: "",
      });

      await loadCollections();
    } catch (error) {
      console.error(error);
      alert(error.message || "Error creando cobranza");
    }
  }

  return (
    <section className="module-page collections-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Cobranzas digitales</p>
          <h1>Mis cobranzas</h1>
          <p className="module-subtitle">
            Consultá tus cobranzas cargadas, revisá observaciones y reenviá
            correcciones.
          </p>
        </div>

        <div className="collections-header-actions">
          <button className="secondary-button" onClick={loadCollections}>
            Actualizar
          </button>

          <button
            className="primary-button"
            onClick={() => setShowCreateModal(true)}
          >
            + Nueva cobranza
          </button>
        </div>
      </div>

      <div className="table-card collections-card">
        <div className="collections-toolbar">
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por cliente, recibo, método o estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="collections-filters">
            <button
              className={statusFilter === "all" ? "filter-pill active" : "filter-pill"}
              onClick={() => setStatusFilter("all")}
            >
              Todas
            </button>

            <button
              className={
                statusFilter === "Pendiente validación"
                  ? "filter-pill active"
                  : "filter-pill"
              }
              onClick={() => setStatusFilter("Pendiente validación")}
            >
              Pendientes
            </button>

            <button
              className={
                statusFilter === "Observada"
                  ? "filter-pill active"
                  : "filter-pill"
              }
              onClick={() => setStatusFilter("Observada")}
            >
              Observadas
            </button>

            <button
              className={
                statusFilter === "Validada"
                  ? "filter-pill active"
                  : "filter-pill"
              }
              onClick={() => setStatusFilter("Validada")}
            >
              Validadas
            </button>

            <button
              className={
                statusFilter === "Rechazada"
                  ? "filter-pill active"
                  : "filter-pill"
              }
              onClick={() => setStatusFilter("Rechazada")}
            >
              Rechazadas
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-table">
            <h3>Cargando cobranzas...</h3>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="empty-table">
            <h3>No hay cobranzas</h3>
            <p>No se encontraron cobranzas con los filtros actuales.</p>
          </div>
        ) : (
          <table className="collections-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Método</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Observación</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredCollections.map((collection) => (
                <tr key={collection.id}>
                  <td>
                    <strong>#{collection.id}</strong>
                  </td>

                  <td>
                    <div className="collection-client-cell">
                      <strong>
                        {collection.cliente ||
                          collection.client ||
                          "Cliente sin nombre"}
                      </strong>

                      <span>
                        {collection.receipt_number
                          ? `Recibo ${collection.receipt_number}`
                          : "Sin recibo"}
                      </span>
                    </div>
                  </td>

                  <td>
                    {collection.created_at
                      ? new Date(collection.created_at).toLocaleDateString("es-AR")
                      : "-"}
                  </td>

                  <td>{collection.payment_method || "-"}</td>

                  <td>
                    <strong className="collection-total">
                      {Number(collection.total || 0).toLocaleString("es-AR", {
                        style: "currency",
                        currency: "ARS",
                      })}
                    </strong>
                  </td>

                  <td>
                    <span
                      className={`status-badge ${getStatusClass(
                        collection.status
                      )}`}
                    >
                      {getStatusLabel(collection.status)}
                    </span>
                  </td>

                  <td>
                    {collection.observation_reason ? (
                      <span className="collection-observation">
                        {collection.observation_reason}
                      </span>
                    ) : (
                      <span className="muted">Sin observación</span>
                    )}
                  </td>

                  <td>
                    <button
                      className="view-btn"
                      onClick={() => setSelectedCollection(collection)}
                    >
                      Ver cobranza
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal crm-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Nueva cobranza</p>
                <h2>Registrar cobranza</h2>
                <p>Cargá una cobranza digital para validación de cuentas corrientes.</p>
              </div>

              <button onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <form className="form-grid" onSubmit={createCollection}>
              <label>
                Cliente
                <input
                  required
                  value={createForm.cliente}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, cliente: event.target.value })
                  }
                  placeholder="Nombre del cliente"
                />
              </label>

              <label>
                Total
                <input
                  required
                  type="number"
                  value={createForm.total}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, total: event.target.value })
                  }
                  placeholder="0"
                />
              </label>

              <label>
                Método
                <select
                  value={createForm.payment_method}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      payment_method: event.target.value,
                    })
                  }
                >
                  <option>Transferencia</option>
                  <option>Efectivo</option>
                  <option>Cheque</option>
                  <option>Retención</option>
                  <option>Otro</option>
                </select>
              </label>

              <label className="full">
                Observaciones
                <textarea
                  value={createForm.notes}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, notes: event.target.value })
                  }
                  placeholder="Detalle de comprobante, facturas o aclaraciones..."
                />
              </label>

              <div className="modal-footer full">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </button>

                <button className="primary-button">
                  Registrar cobranza
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCollection && (
        <CollectionDetail
          collection={selectedCollection}
          user={currentUser}
          onClose={() => setSelectedCollection(null)}
          onRefresh={handleRefresh}
        />
      )}
    </section>
  );
}