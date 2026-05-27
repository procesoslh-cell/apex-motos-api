import { useEffect, useState } from "react";

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

export default function CollectionDetail({
  collection,
  user,
  onClose,
  onRefresh,
}) {
  const [detail, setDetail] = useState(collection);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);

  const [showObservationBox, setShowObservationBox] = useState(false);
  const [observationReason, setObservationReason] = useState("");

  const [resubmitNotes, setResubmitNotes] = useState(collection?.notes || "");

  useEffect(() => {
    async function loadDetail() {
      if (!collection?.id) return;

      try {
        setLoadingDetail(true);

        const response = await fetch(`${API_URL}/api/collections/${collection.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "No se pudo cargar el detalle.");
        }

        setDetail(data);
        setResubmitNotes(data.notes || "");
      } catch (error) {
        console.error(error);
        alert(error.message || "Error cargando detalle de cobranza.");
      } finally {
        setLoadingDetail(false);
      }
    }

    loadDetail();
  }, [collection?.id]);

  if (!collection) return null;

  const canCuentasAct =
    user?.role === "cuentas" &&
    ["Pendiente validación", "Observada", "pending", "observed"].includes(
      detail?.status
    );

  const canVendorAct =
    user?.role === "vendedor" &&
    ["Observada", "observed"].includes(detail?.status);

  async function updateStatus(status) {
    try {
      setLoadingAction(true);

      const response = await fetch(`${API_URL}/api/collections/${detail.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          user: user?.name || user?.username || user?.email || "",
          observation_reason: status === "Observada" ? observationReason : "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo actualizar la cobranza.");
      }

      await onRefresh(detail.id);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error actualizando cobranza.");
    } finally {
      setLoadingAction(false);
    }
  }

  async function resubmit() {
    try {
      setLoadingAction(true);

      const response = await fetch(`${API_URL}/api/collections/${detail.id}/resubmit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_method: detail.payment_method,
          notes: resubmitNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo reenviar.");
      }

      await onRefresh(detail.id);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error reenviando cobranza.");
    } finally {
      setLoadingAction(false);
    }
  }

  async function uploadFile(file) {
    if (!file) return;

    try {
      setLoadingAction(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/collections/${detail.id}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo subir el comprobante.");
      }

      const refreshResponse = await fetch(`${API_URL}/api/collections/${detail.id}`);
      const refreshData = await refreshResponse.json();

      if (refreshResponse.ok) {
        setDetail(refreshData);
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Error subiendo comprobante.");
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal detail-modal collection-detail-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Detalle de cobranza</p>

            <h2>
              {detail?.receipt_number
                ? `Recibo ${detail.receipt_number}`
                : `Cobranza #${detail?.id || collection.id}`}
            </h2>

            <p>
              {detail?.cliente || "Cliente sin nombre"} ·{" "}
              {formatMoney(detail?.total)}
            </p>
          </div>

          <button onClick={onClose}>×</button>
        </div>

        {loadingDetail ? (
          <div className="empty-box">
            Cargando detalle de cobranza...
          </div>
        ) : (
          <>
            <div className="collection-status-banner">
              <div>
                <span
                  className={`status-badge ${getStatusClass(detail.status)}`}
                >
                  {getStatusLabel(detail.status)}
                </span>

                <h3>
                  {detail.status === "Observada"
                    ? "Cobranza observada"
                    : detail.status === "Validada"
                    ? "Cobranza validada"
                    : detail.status === "Rechazada"
                    ? "Cobranza rechazada"
                    : "Pendiente de validación"}
                </h3>

                <p>
                  {detail.status === "Observada"
                    ? detail.observation_reason ||
                      "Cuentas solicitó una corrección sobre esta cobranza."
                    : detail.status === "Validada"
                    ? `Validada por ${detail.validated_by || "Cuentas"} el ${formatDate(
                        detail.validated_at
                      )}.`
                    : detail.status === "Rechazada"
                    ? "La cobranza fue rechazada por Cuentas."
                    : "La cobranza está pendiente de revisión por Cuentas Corrientes."}
                </p>
              </div>

              <strong>{formatMoney(detail.total)}</strong>
            </div>

            <div className="request-top-grid collection-detail-layout">
              <div className="request-main-info">
                <div className="detail-section">
                  <h3>Información principal</h3>

                  <div className="detail-grid">
                    <div className="detail-box">
                      <strong>Cliente</strong>
                      <p>{detail.cliente || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Vendedor</strong>
                      <p>{detail.asesor || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Método de pago</strong>
                      <p>{detail.payment_method || "-"}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Fecha de carga</strong>
                      <p>{formatDate(detail.created_at)}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Fecha validación</strong>
                      <p>{formatDate(detail.validated_at)}</p>
                    </div>

                    <div className="detail-box">
                      <strong>Validado por</strong>
                      <p>{detail.validated_by || "-"}</p>
                    </div>

                    {detail.notes && (
                      <div className="detail-box full">
                        <strong>Observación del vendedor</strong>
                        <p>{detail.notes}</p>
                      </div>
                    )}

                    {detail.observation_reason && (
                      <div className="detail-box full collection-warning-box">
                        <strong>Motivo / pedido de Cuentas</strong>
                        <p>{detail.observation_reason}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Facturas incluidas</h3>

                  {detail.items?.length > 0 ? (
                    <div className="collection-items-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Factura</th>
                            <th>Monto aplicado</th>
                          </tr>
                        </thead>

                        <tbody>
                          {detail.items.map((item) => (
                            <tr key={item.id || item.invoice_id || item.invoice_number}>
                              <td>
                                <strong>{item.invoice_number || "-"}</strong>
                              </td>

                              <td>
                                <strong>{formatMoney(item.amount)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-box">No hay facturas cargadas.</div>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Comprobantes</h3>

                  {detail.files?.length > 0 ? (
                    <div className="files-grid">
                      {detail.files.map((file) => (
                        <div className="file-card" key={file.id || file.filename}>
                          <strong>{file.original_name || file.filename}</strong>

                          <p>
                            {file.uploaded_at
                              ? `Subido el ${formatDate(file.uploaded_at)}`
                              : "Archivo adjunto"}
                          </p>

                          <a
                            href={`${API_URL}/uploads/collections/${file.filename}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir comprobante
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-box">No hay comprobantes cargados.</div>
                  )}
                </div>
              </div>

              <div className="request-side-panel">
                <div className="side-card">
                  <h3>Resumen</h3>

                  <div className="collection-summary-list">
                    <div>
                      <span>Estado</span>
                      <strong>{getStatusLabel(detail.status)}</strong>
                    </div>

                    <div>
                      <span>Total</span>
                      <strong>{formatMoney(detail.total)}</strong>
                    </div>

                    <div>
                      <span>Recibo</span>
                      <strong>{detail.receipt_number || "-"}</strong>
                    </div>

                    <div>
                      <span>Facturas</span>
                      <strong>{detail.items?.length || 0}</strong>
                    </div>

                    <div>
                      <span>Comprobantes</span>
                      <strong>{detail.files?.length || 0}</strong>
                    </div>
                  </div>
                </div>

                <div className="side-card">
                  <h3>Comprobantes</h3>

                  <label className="collection-upload-button">
                    Subir comprobante
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      hidden
                      disabled={loadingAction}
                      onChange={(event) => uploadFile(event.target.files[0])}
                    />
                  </label>

                  <p className="collection-helper">
                    Formatos permitidos: PDF, JPG, JPEG o PNG.
                  </p>
                </div>

                {canCuentasAct && (
                  <div className="side-card">
                    <h3>Acciones de Cuentas</h3>

                    {showObservationBox && (
                      <div className="collection-form-block">
                        <label>Motivo de observación</label>
                        <textarea
                          value={observationReason}
                          onChange={(e) => setObservationReason(e.target.value)}
                          placeholder="Ej: Falta comprobante, monto incorrecto, factura mal imputada..."
                        />
                      </div>
                    )}

                    <div className="status-actions vertical-actions">
                      <button
                        className="status-success"
                        disabled={loadingAction}
                        onClick={() => updateStatus("Validada")}
                      >
                        Validar
                      </button>

                      {!showObservationBox ? (
                        <button
                          className="status-warning"
                          disabled={loadingAction}
                          onClick={() => setShowObservationBox(true)}
                        >
                          Observar
                        </button>
                      ) : (
                        <button
                          className="status-warning"
                          disabled={loadingAction || !observationReason.trim()}
                          onClick={() => updateStatus("Observada")}
                        >
                          Confirmar observación
                        </button>
                      )}

                      <button
                        className="status-danger"
                        disabled={loadingAction}
                        onClick={() => updateStatus("Rechazada")}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                )}

                {canVendorAct && (
                  <div className="side-card collection-observed-panel">
                    <h3>Corregir cobranza</h3>

                    <p>
                      Cuentas observó esta cobranza. Agregá el comentario de
                      corrección y reenviá.
                    </p>

                    <div className="collection-form-block">
                      <label>Comentario para Cuentas</label>
                      <textarea
                        value={resubmitNotes}
                        onChange={(e) => setResubmitNotes(e.target.value)}
                        placeholder="Indicá qué corregiste o agregaste..."
                      />
                    </div>

                    <button
                      className="primary-button"
                      disabled={loadingAction}
                      onClick={resubmit}
                    >
                      Corregir y reenviar
                    </button>
                  </div>
                )}

                <div className="side-card">
                  <h3>Actividad</h3>

                  <div className="timeline-list">
                    <div className="timeline-item">
                      <strong>Cobranza registrada</strong>
                      <p>{detail.asesor || "Vendedor"} cargó la cobranza.</p>
                      <span>{formatDate(detail.created_at)}</span>
                    </div>

                    {detail.validated_at && (
                      <div className="timeline-item">
                        <strong>{getStatusLabel(detail.status)}</strong>
                        <p>
                          {detail.validated_by || "Cuentas"} actualizó el estado
                          de la cobranza.
                        </p>
                        <span>{formatDate(detail.validated_at)}</span>
                      </div>
                    )}

                    {detail.observation_reason && (
                      <div className="timeline-item">
                        <strong>Observación de Cuentas</strong>
                        <p>{detail.observation_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}