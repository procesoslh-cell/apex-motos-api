import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

export default function ClientCommercialProfile({
  client,
  clienteId,
  onClose,
  onAssignLead,
}) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  const resolvedClientId = clienteId || client?.cliente_id || client?.odoo_cliente_id;

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedClientId]);

  async function loadProfile() {
    if (!resolvedClientId) return;

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/comercial/clientes/${resolvedClientId}/perfil`
      );

      const json = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(json?.error || "No se pudo cargar el perfil comercial.");
      }

      setProfile(json);
    } catch (error) {
      console.error(error);
      alert(error.message || "Error cargando perfil comercial.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal detail-modal client-profile-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Perfil comercial</p>

            <h2>
              {profile?.cliente?.cliente ||
                client?.cliente ||
                client?.client ||
                client?.name ||
                "Cliente"}
            </h2>

            <p>
              Historial, categorías, deuda, presupuestos y oportunidades CRM
              vinculadas.
            </p>
          </div>

          <button onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="empty-box">Cargando perfil comercial...</div>
        ) : !resolvedClientId ? (
          <div className="empty-box">
            Esta oportunidad todavía no tiene cliente Odoo vinculado.
          </div>
        ) : (
          <div className="request-top-grid">
            <div className="request-main-info">
              <div className="detail-section">
                <h3>Resumen comercial</h3>

                <div className="detail-grid">
                  <div className="detail-box">
                    <strong>Cliente</strong>
                    <p>
                      {profile?.cliente?.cliente ||
                        client?.cliente ||
                        client?.client ||
                        "-"}
                    </p>
                  </div>

                  <div className="detail-box">
                    <strong>Asesor</strong>
                    <p>{profile?.cliente?.asesor || client?.asesor || "-"}</p>
                  </div>

                  <div className="detail-box">
                    <strong>Total 12M</strong>
                    <p>{formatMoney(profile?.resumen?.total12m)}</p>
                  </div>

                  <div className="detail-box">
                    <strong>Categoría principal</strong>
                    <p>{profile?.resumen?.categoriaPrincipal || "-"}</p>
                  </div>

                  <div className="detail-box">
                    <strong>Condición de pago</strong>
                    <p>{profile?.resumen?.condicionPago || "-"}</p>
                  </div>

                  <div className="detail-box">
                    <strong>Deuda pendiente</strong>
                    <p>{formatMoney(profile?.resumen?.deudaPendiente)}</p>
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
                      {(profile?.categorias || []).length === 0 ? (
                        <tr>
                          <td colSpan="4">Sin datos de categorías.</td>
                        </tr>
                      ) : (
                        profile.categorias.map((item) => (
                          <tr key={item.categoria}>
                            <td>{item.categoria}</td>
                            <td>{item.facturas || 0}</td>
                            <td>
                              {Number(item.unidades || 0).toLocaleString(
                                "es-AR"
                              )}
                            </td>
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
                      {(profile?.ultimasCompras || []).length === 0 ? (
                        <tr>
                          <td colSpan="4">Sin compras recientes.</td>
                        </tr>
                      ) : (
                        profile.ultimasCompras.map((item) => (
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
              {onAssignLead && (
                <div className="side-card">
                  <h3>Acciones comerciales</h3>

                  <button
                    className="primary-button"
                    style={{ width: "100%" }}
                    onClick={() => onAssignLead(client)}
                  >
                    Asignar lead de reactivación
                  </button>

                  <p className="collection-helper">
                    El lead se crea automáticamente en el CRM para seguimiento
                    del vendedor o del Centro de Contacto.
                  </p>
                </div>
              )}

              <div className="side-card">
                <h3>Oportunidades CRM</h3>

                <div className="timeline-list">
                  {(profile?.oportunidades || []).length === 0 ? (
                    <div className="empty-box">Sin oportunidades CRM.</div>
                  ) : (
                    profile.oportunidades.map((item) => (
                      <div className="timeline-item" key={item.id}>
                        <strong>
                          #{item.id} · {item.type}
                        </strong>
                        <p>
                          {item.stage} · {item.assigned_to || "Sin asignar"}
                        </p>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="side-card">
                <h3>Presupuestos recientes</h3>

                <div className="timeline-list">
                  {(profile?.presupuestos || []).length === 0 ? (
                    <div className="empty-box">
                      Sin presupuestos recientes.
                    </div>
                  ) : (
                    profile.presupuestos.map((item) => (
                      <div
                        className="timeline-item"
                        key={item.presupuesto_id}
                      >
                        <strong>{item.presupuesto}</strong>
                        <p>
                          {formatMoney(item.monto)} · {item.state}
                        </p>
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
  );
}
