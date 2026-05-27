import { useEffect, useMemo, useState } from "react";
import TripMap from "./TripMap";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("es-AR");
  } catch {
    return value;
  }
}

function getTripClosureSla(trip) {
  if (!trip?.end_date) {
    return {
      label: "Sin fecha fin",
      className: "sla-gray",
      detail: "La gira no tiene fecha de finalización cargada.",
    };
  }

  if (trip.supervisor_status === "Aprobada" || trip.status === "Cerrada") {
    return {
      label: "Cerrada",
      className: "sla-green",
      detail: "La gira ya fue revisada por supervisor.",
    };
  }

  if (trip.closed_at) {
    return {
      label: "En revisión",
      className: "sla-yellow",
      detail: "El asesor cargó la devolución. Falta control supervisor.",
    };
  }

  const now = new Date();
  const endDate = new Date(trip.end_date);
  endDate.setHours(23, 59, 59, 999);

  if (now <= endDate) {
    return {
      label: "En proceso",
      className: "sla-green",
      detail: `Finaliza ${formatDate(trip.end_date)}.`,
    };
  }

  const dueAt = new Date(endDate);
  dueAt.setDate(dueAt.getDate() + 3);

  const diffHours = Math.ceil((dueAt.getTime() - now.getTime()) / 1000 / 60 / 60);

  if (diffHours >= 0) {
    return {
      label: "Pendiente devolución",
      className: diffHours <= 24 ? "sla-yellow" : "sla-green",
      detail: `El asesor tiene ${diffHours}hs para cerrar resultados.`,
    };
  }

  return {
    label: "Vencida",
    className: "sla-red",
    detail: `La devolución está vencida hace ${Math.abs(diffHours)}hs.`,
  };
}

export default function TripDetail({ tripId, user, onClose, onRefresh }) {
  const [trip, setTrip] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [comment, setComment] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);

  const [pedidos, setPedidos] = useState("");
  const [monto, setMonto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [closing, setClosing] = useState(false);

  const [supervisorResult, setSupervisorResult] = useState("Aprobada");
  const [supervisorComments, setSupervisorComments] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const [message, setMessage] = useState("");

  const isSupervisor = ["admin", "supervisor", "gerente", "jefe"].includes(
    user?.role
  );

  useEffect(() => {
    loadTrip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function readJson(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error("El servidor devolvió una respuesta inválida.");
    }
  }

  async function loadTrip() {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/trips/${tripId}`);
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo cargar la gira.");
      }

      setTrip(data.trip);
      setClients(Array.isArray(data.clients) ? data.clients : []);
      setPedidos(data.trip?.result_orders_count || "");
      setMonto(data.trip?.result_estimated_amount || "");
      setObservaciones(data.trip?.result_notes || "");
      setSupervisorResult(data.trip?.supervisor_status || "Aprobada");
      setSupervisorComments(data.trip?.supervisor_comments || "");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "No se pudo cargar la gira.");
    } finally {
      setLoading(false);
    }
  }

  const visitedClients = useMemo(
    () => clients.filter((client) => client.visit_status === "Visitado"),
    [clients]
  );

  const unvisitedClients = useMemo(
    () => clients.filter((client) => client.visit_status !== "Visitado"),
    [clients]
  );

  async function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("El navegador no permite geolocalización."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => reject(new Error("No se pudo obtener la ubicación.")),
        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      );
    });
  }

  async function registerVisit() {
    if (!selectedClient) {
      setMessage("Seleccioná un cliente.");
      return;
    }

    try {
      setSavingVisit(true);
      setMessage("Obteniendo ubicación...");

      const position = await getCurrentPosition();

      const response = await fetch(`${API_URL}/api/trips/visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          cliente_id: selectedClient.cliente_id,
          comentario: comment,
          lat: position.lat,
          lng: position.lng,
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo registrar la visita.");
      }

      setMessage("Visita registrada correctamente.");
      setSelectedClient(null);
      setComment("");

      await loadTrip();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error(error);
      setMessage(
        error.message ||
          "No se pudo registrar la visita. Revisá permisos de ubicación."
      );
    } finally {
      setSavingVisit(false);
    }
  }

  async function closeTrip() {
    if (!pedidos && !monto && !observaciones.trim()) {
      setMessage("Cargá al menos un resultado u observación.");
      return;
    }

    try {
      setClosing(true);

      const response = await fetch(`${API_URL}/api/trips/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          pedidos: Number(pedidos || 0),
          monto: Number(monto || 0),
          observaciones,
          user: user?.name || "Sistema",
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo cerrar la gira.");
      }

      setMessage("Gira cerrada y enviada a revisión.");
      await loadTrip();

      if (onRefresh) onRefresh();

      setTimeout(() => {
        if (onClose) onClose();
      }, 900);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Error cerrando la gira.");
    } finally {
      setClosing(false);
    }
  }

  async function reviewTrip() {
    if (!supervisorComments.trim()) {
      setMessage("Cargá una devolución u observación de supervisor.");
      return;
    }

    try {
      setReviewSaving(true);

      const response = await fetch(`${API_URL}/api/trips/${tripId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisor_status: supervisorResult,
          supervisor_comments: supervisorComments,
          supervisor: user?.name || "Supervisor",
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar la revisión.");
      }

      setMessage("Revisión de supervisor guardada.");
      await loadTrip();

      if (onRefresh) onRefresh();

      setTimeout(() => {
        if (onClose) onClose();
      }, 900);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Error guardando revisión.");
    } finally {
      setReviewSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal detail-modal">
          <div className="empty-box">Cargando gira...</div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="modal-overlay">
        <div className="modal detail-modal">
          <div className="empty-box">No se encontró la gira.</div>
          <button className="secondary-button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const sla = getTripClosureSla(trip);
  const canCloseTrip =
    trip.status !== "Cerrada" &&
    trip.supervisor_status !== "Aprobada" &&
    !trip.closed_at;

  const canReviewTrip = isSupervisor && Boolean(trip.closed_at);

  return (
    <div className="modal-overlay">
      <div className="modal detail-modal trip-detail-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Detalle de gira</p>
            <h2>{trip.nombre}</h2>
            <p>
              {trip.asesor} · {formatDate(trip.start_date)} →{" "}
              {formatDate(trip.end_date)}
            </p>
          </div>

          <button onClick={onClose}>×</button>
        </div>

        {message && <div className="radiography-error">{message}</div>}

        <div className="request-top-grid">
          <div className="request-main-info">
            <section className="detail-section">
              <h3>Resumen operativo</h3>

              <div className="detail-grid">
                <div className="detail-box">
                  <strong>Estado cierre</strong>
                  <span className={`sla-pill ${sla.className}`}>
                    {sla.label}
                  </span>
                  <p>{sla.detail}</p>
                </div>

                <div className="detail-box">
                  <strong>Clientes</strong>
                  <p>{clients.length}</p>
                </div>

                <div className="detail-box">
                  <strong>Visitados</strong>
                  <p>{visitedClients.length}</p>
                </div>

                <div className="detail-box">
                  <strong>Pendientes</strong>
                  <p>{unvisitedClients.length}</p>
                </div>

                <div className="detail-box full">
                  <strong>Objetivos / observaciones iniciales</strong>
                  <p>{trip.observaciones || "Sin observaciones"}</p>
                </div>
              </div>
            </section>

            <section className="detail-section">
              <h3>Clientes de la gira</h3>

              <div className="trip-client-list">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    className={`trip-client-row ${
                      selectedClient?.id === client.id ? "selected" : ""
                    }`}
                    onClick={() => setSelectedClient(client)}
                  >
                    <div className="trip-client-info">
                      <strong>{client.cliente}</strong>
                      <span>
                        {client.visit_status || "Pendiente"}{" "}
                        {client.visited_at ? `· ${formatDate(client.visited_at)}` : ""}
                      </span>
                    </div>

                    <span
                      className={
                        client.visit_status === "Visitado"
                          ? "status-active"
                          : "status-inactive"
                      }
                    >
                      {client.visit_status === "Visitado" ? "Visitado" : "Pendiente"}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="detail-section">
              <h3>Mapa de la gira</h3>
              <TripMap clients={clients} />
            </section>

            {canCloseTrip && (
              <section className="detail-section">
                <h3>Registrar visita</h3>
                <p>
                  Seleccioná un cliente, cargá comentario y registrá la ubicación
                  del dispositivo.
                </p>

                <textarea
                  className="trip-textarea"
                  placeholder="Comentario de visita..."
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />

                <button
                  className="primary-button trip-save-button"
                  onClick={registerVisit}
                  disabled={savingVisit}
                >
                  {savingVisit ? "Guardando visita..." : "Marcar visitado con ubicación"}
                </button>
              </section>
            )}

            <section className="detail-section">
              <h3>Cierre de gira del asesor</h3>

              <div className="trip-form-grid">
                <input
                  className="search-input"
                  type="number"
                  placeholder="Pedidos levantados"
                  value={pedidos}
                  onChange={(event) => setPedidos(event.target.value)}
                  disabled={!canCloseTrip}
                />

                <input
                  className="search-input"
                  type="number"
                  placeholder="Monto estimado"
                  value={monto}
                  onChange={(event) => setMonto(event.target.value)}
                  disabled={!canCloseTrip}
                />
              </div>

              <textarea
                className="trip-textarea"
                placeholder="Resultado general de la gira, oportunidades, problemas detectados..."
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
                disabled={!canCloseTrip}
              />

              {canCloseTrip ? (
                <button
                  className="primary-button trip-save-button"
                  onClick={closeTrip}
                  disabled={closing}
                >
                  {closing ? "Cerrando..." : "Cerrar gira y enviar a revisión"}
                </button>
              ) : (
                <div className="empty-box">
                  La devolución del asesor ya fue enviada.
                </div>
              )}
            </section>
          </div>

          <div className="request-side-panel">
            <div className="side-card">
              <h3>Control supervisor</h3>

              {!trip.closed_at ? (
                <div className="empty-box">
                  Todavía falta la devolución del asesor.
                </div>
              ) : (
                <>
                  <div className="collection-summary-list">
                    <div>
                      <span>Pedidos</span>
                      <strong>{trip.result_orders_count || 0}</strong>
                    </div>

                    <div>
                      <span>Monto estimado</span>
                      <strong>
                        {Number(trip.result_estimated_amount || 0).toLocaleString(
                          "es-AR",
                          {
                            style: "currency",
                            currency: "ARS",
                          }
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Estado supervisor</span>
                      <strong>{trip.supervisor_status || "Pendiente"}</strong>
                    </div>
                  </div>

                  <label>
                    Resultado supervisor
                    <select
                      className="status-filter"
                      value={supervisorResult}
                      onChange={(event) => setSupervisorResult(event.target.value)}
                      disabled={!canReviewTrip}
                    >
                      <option>Aprobada</option>
                      <option>Devuelta</option>
                      <option>Observada</option>
                    </select>
                  </label>

                  <textarea
                    className="trip-textarea"
                    placeholder="Devolución del supervisor, oportunidades, correcciones o acciones a seguir..."
                    value={supervisorComments}
                    onChange={(event) => setSupervisorComments(event.target.value)}
                    disabled={!canReviewTrip}
                  />

                  {canReviewTrip && (
                    <button
                      className="primary-button trip-save-button"
                      onClick={reviewTrip}
                      disabled={reviewSaving}
                    >
                      {reviewSaving ? "Guardando..." : "Guardar revisión y cerrar"}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="side-card">
              <h3>Resultado asesor</h3>
              <p>{trip.result_notes || "Sin devolución cargada."}</p>
            </div>

            {trip.supervisor_comments && (
              <div className="side-card">
                <h3>Devolución supervisor</h3>
                <p>{trip.supervisor_comments}</p>
                <span>{trip.supervisor_reviewed_at || ""}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
