import { useEffect, useState } from "react";
import CollectionDetail from "./CollectionDetail";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function CollectionsAdmin({ user }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedCollection, setSelectedCollection] =
    useState(null);

  const [collectionDetail, setCollectionDetail] =
    useState(null);

  useEffect(() => {
    loadCollections();
  }, []);

  async function loadCollections() {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/collections`
      );

      const data = await response.json();

      setCollections(data || []);
    } catch (error) {
      console.error(error);

      setMessage(
        "No se pudieron cargar las cobranzas."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openCollection(collectionId) {
    try {
      const response = await fetch(
        `${API_URL}/api/collections/${collectionId}`
      );

      const data = await response.json();

      setCollectionDetail(data);
      setSelectedCollection(collectionId);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="collections-page">
      <div className="radiography-header">
        <div>
          <h1>Validación de cobranzas</h1>

          <p>
            Control de cobranzas registradas por
            vendedores y validación de Cuentas
            Corrientes.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadCollections}
        >
          Actualizar
        </button>
      </div>

      {message && (
        <div className="radiography-error">
          {message}
        </div>
      )}

      <section className="trip-form-card">
        <div className="trip-header">
          <div>
            <h2>Cobranzas registradas</h2>

            <p>
              Revisá, validá u observá cobranzas.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="empty-message">
            Cargando cobranzas...
          </p>
        ) : collections.length === 0 ? (
          <p className="empty-message">
            No hay cobranzas registradas.
          </p>
        ) : (
          <div className="requests-table-wrapper">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Recibo</th>
                  <th>Cliente</th>
                  <th>Asesor</th>
                  <th>Método</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.id}>
                    <td>
                      {collection.receipt_number}
                    </td>

                    <td>{collection.cliente}</td>

                    <td>
                      {collection.asesor || "-"}
                    </td>

                    <td>
                      {collection.payment_method}
                    </td>

                    <td>
                      $
                      {Number(
                        collection.total || 0
                      ).toLocaleString("es-AR")}
                    </td>

                    <td>
                      <span
                        className={`status-badge ${
                          collection.status ===
                          "Validada"
                            ? "status-approved"
                            : collection.status ===
                              "Observada"
                            ? "status-pending"
                            : collection.status ===
                              "Rechazada"
                            ? "status-rejected"
                            : "status-review"
                        }`}
                      >
                        {collection.status}
                      </span>
                    </td>

                    <td>
                      {collection.created_at}
                    </td>

                    <td>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          openCollection(
                            collection.id
                          )
                        }
                      >
                        Ver cobranza
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCollection &&
        collectionDetail && (
          <CollectionDetail
            collection={collectionDetail}
            user={user}
            onClose={() => {
              setSelectedCollection(null);
              setCollectionDetail(null);
            }}
            onRefresh={async (
              collectionId
            ) => {
              await loadCollections();

              await openCollection(
                collectionId
              );
            }}
          />
        )}
    </div>
  );
}