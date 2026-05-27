import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function CommercialDashboard() {
  const [data, setData] = useState({
    kpis: {},
    topVendors: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/dashboard/comercial`
      );

      const json = await response.json();

      setData({
        kpis: json.kpis || {},
        topVendors: json.topVendors || [],
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const kpis = data.kpis;

  const visitTotal =
    Number(kpis.totalVisits || 0) +
    Number(kpis.pendingVisits || 0);

  const visitCompliance =
    visitTotal > 0
      ? Math.round(
          (Number(kpis.totalVisits || 0) / visitTotal) * 100
        )
      : 0;

  return (
    <div className="commercial-dashboard">
      <div className="radiography-header">
        <div>
          <h1>Dashboard Supervisor</h1>

          <p>
            Control operativo de solicitudes, aprobaciones, SLA, giras y
            desempeño comercial.
          </p>
        </div>

        <button className="secondary-button" onClick={loadDashboard}>
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="trip-form-card">
          Cargando indicadores...
        </div>
      ) : (
        <>
          <div className="dashboard-kpi-grid">
            <div className="stat-card">
              <span>Solicitudes pendientes</span>
              <strong>{kpis.pendingRequests || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Notas crédito pendientes</span>
              <strong>{kpis.pendingCreditNotes || 0}</strong>
            </div>

            <div className="stat-card">
              <span>SLA vencidos</span>
              <strong>{kpis.expiredSla || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Giras activas</span>
              <strong>{kpis.activeTrips || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Giras pendientes revisión</span>
              <strong>{kpis.closedTrips || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Cumplimiento visitas</span>
              <strong>{visitCompliance}%</strong>
            </div>

            <div className="stat-card">
              <span>Visitas realizadas</span>
              <strong>{kpis.totalVisits || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Pedidos levantados</span>
              <strong>{kpis.totalOrders || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Monto estimado</span>
              <strong>
                $
                {Number(kpis.totalAmount || 0).toLocaleString("es-AR")}
              </strong>
            </div>
          </div>

          <section className="trip-form-card">
            <div className="trip-header">
              <div>
                <h2>Ranking comercial</h2>

                <p>
                  Resultado acumulado por asesor según giras cerradas,
                  pedidos y montos informados.
                </p>
              </div>
            </div>

            {data.topVendors.length === 0 ? (
              <p className="empty-message">
                Todavía no hay resultados comerciales cargados.
              </p>
            ) : (
              <div className="dashboard-ranking">
                {data.topVendors.map((vendor, index) => (
                  <div className="dashboard-ranking-row" key={vendor.asesor}>
                    <div className="ranking-position">
                      #{index + 1}
                    </div>

                    <div className="ranking-info">
                      <strong>{vendor.asesor || "Sin asesor"}</strong>
                      <span>{vendor.giras} giras planificadas</span>
                    </div>

                    <div className="ranking-metric">
                      <span>Pedidos</span>
                      <strong>{vendor.pedidos || 0}</strong>
                    </div>

                    <div className="ranking-metric">
                      <span>Monto</span>
                      <strong>
                        $
                        {Number(vendor.monto || 0).toLocaleString("es-AR")}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}