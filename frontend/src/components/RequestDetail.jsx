import { useState } from "react";


const uploadCategories = [
  "Alta ARCA / ex AFIP",
  "Rentas Provincial",
  "CM 05",
  "Boleta de servicio",
  "Foto local interior",
  "Foto frente exterior",
  "Otro documento",
];

function RequestDetail({
  request,
  currentUser,
  getSLA,
  getHoursOpen,
  getStatusClass,
  onClose,
  onAddComment,
  onUpdateStatus,
  onUploadFile,
}) {
  const [comment, setComment] = useState("");

  const [showDocsRequest, setShowDocsRequest] = useState(false);
  const [missingDocs, setMissingDocs] = useState([]);
  const [customMissingDoc, setCustomMissingDoc] = useState("");

  const [selectedCategory, setSelectedCategory] =
    useState(uploadCategories[0]);

  const [selectedFile, setSelectedFile] =
    useState(null);
    function toggleMissingDoc(doc) {
  setMissingDocs((prev) =>
    prev.includes(doc)
      ? prev.filter((item) => item !== doc)
      : [...prev, doc]
  );
}

async function handleRequestDocumentation() {
  const docs = [...missingDocs];

  if (customMissingDoc.trim()) {
    docs.push(customMissingDoc.trim());
  }

  if (docs.length === 0) {
    alert("Seleccioná al menos un documento.");
    return;
  }

  const message = `Se solicitó al cliente la siguiente documentación:\n\n${docs
    .map((doc) => `- ${doc}`)
    .join("\n")}`;

  await onAddComment(request.id, message);
  await onUpdateStatus(request.id, "Faltan datos");

  setShowDocsRequest(false);
  setMissingDocs([]);
  setCustomMissingDoc("");

  if (onClose) onClose();
}

  const sla = getSLA(request);
   const isNotaCredito =
   request.type === "Nota de crédito";

   const isLimiteCredito =
   request.type === "Límite de crédito";

   const isAltaCliente =
   request.type === "Alta de cliente";
  
   async function handleAddComment() {
    if (!comment.trim()) return;

    await onAddComment(
      request.id,
      comment
    );

    setComment("");
  }
  async function handleUpdateAndClose(status) {
    await onUpdateStatus(request.id, status);
    if (onClose) onClose();
  }


  async function handleUpload() {
    if (!selectedFile) {
      alert("Seleccioná un archivo");
      return;
    }

    await onUploadFile(
      request.id,
      selectedFile,
      selectedCategory
    );

    setSelectedFile(null);

    alert("Archivo cargado");
  }

  return (
    <div className="modal-overlay">
      <div className="modal detail-modal">
        <div className="modal-header">
          <div>
            <h2>
              {request.type}
            </h2>

            <p>
              Solicitud #
              {request.id}
            </p>
          </div>

          <button onClick={onClose}>
            ×
          </button>
        </div>

        <div className="request-top-grid">
          <div className="request-main-info">
            <div className="detail-grid">
  <div className="detail-box">
    <strong>Cliente</strong>

    <p>{request.client}</p>
  </div>

  <div className="detail-box">
    <strong>Estado</strong>

    <span
      className={`status-pill ${getStatusClass(
        request.status
      )}`}
    >
      {request.status}
    </span>
  </div>

  <div className="detail-box">
    <strong>SLA</strong>

    <span
      className={`sla-pill ${sla.className}`}
    >
      {sla.text}
    </span>
  </div>

  <div className="detail-box">
    <strong>Horas abiertas</strong>

    <p>
      {getHoursOpen(request) === "-"
        ? "-"
        : `${getHoursOpen(request)}hs`}
    </p>
  </div>

  <div className="detail-box">
    <strong>Solicitante</strong>

    <p>{request.requester}</p>
  </div>

  <div className="detail-box">
    <strong>CUIT</strong>

    <p>{request.cuit || "-"}</p>
  </div>

  {isAltaCliente && (
    <>
      <div className="detail-box">
        <strong>Correo</strong>

        <p>{request.email}</p>
      </div>

      <div className="detail-box">
        <strong>Celular</strong>

        <p>{request.mobile}</p>
      </div>

      <div className="detail-box full">
        <strong>Dirección local</strong>

        <p>{request.storeAddress}</p>
      </div>

      <div className="detail-box full">
        <strong>Dirección entrega</strong>

        <p>{request.deliveryAddress}</p>
      </div>
    </>
  )}

  {isNotaCredito && (
    <>
      <div className="detail-box">
        <strong>Factura</strong>

        <p>
          {request.description
            ?.split("Factura: ")[1]
            ?.split("\n")[0] || "-"}
        </p>
      </div>

      <div className="detail-box">
        <strong>Monto factura</strong>

        <p>
          {request.description
            ?.split("Monto factura: ")[1]
            ?.split("\n")[0] || "-"}
        </p>
      </div>

      <div className="detail-box full">
        <strong>Workflow</strong>

        <p>
          Requiere aprobación de supervisor antes
          de pasar a Cuentas Corrientes.
        </p>
      </div>
    </>
  )}

  {isLimiteCredito && (
    <>
      <div className="detail-box">
        <strong>Presupuesto</strong>

        <p>
          {request.description
            ?.split("Presupuesto: ")[1]
            ?.split("\n")[0] || "-"}
        </p>
      </div>

      <div className="detail-box">
        <strong>Monto presupuesto</strong>

        <p>
          {request.description
            ?.split(
              "Monto presupuesto: "
            )[1]
            ?.split("\n")[0] || "-"}
        </p>
      </div>
    </>
  )}

  <div className="detail-box full">
    <strong>Observaciones</strong>

    <p>{request.description}</p>
  </div>
</div>
{currentUser.role === "supervisor" &&
  request.type === "Nota de crédito" &&
  request.status === "Pendiente aprobación supervisor" && (
    <div className="status-actions">
      <button
        className="status-success"
        onClick={() => handleUpdateAndClose("Nueva")}
      >
        Aprobar y enviar a Cuentas
      </button>

      <button
        className="status-danger"
        onClick={() => handleUpdateAndClose("Rechazada por supervisor")}
      >
        Rechazar nota de crédito
      </button>
    </div>
  )}
            {currentUser.role === "cuentas" &&
  request.status !== "Pendiente aprobación supervisor" && (
              <div className="status-actions">
                <button
                  className="status-review"
                  onClick={() => handleUpdateAndClose("En revisión")}
                >
                  En revisión
                </button>

                <button
                  className="status-warning"
                  onClick={() => handleUpdateAndClose("Faltan datos")}
                >
                  Faltan datos
                </button>
                <button
                  className="status-warning"
                   onClick={() => setShowDocsRequest(true)}
>
  Solicitar documentación
</button>
                <button
                  className="status-success"
                  onClick={() => handleUpdateAndClose("Finalizada")}
                >
                  Finalizar
                </button>

                <button
                  className="status-danger"
                  onClick={() => handleUpdateAndClose("Rechazada")}
                >
                  Rechazar
                </button>
              </div>
            )}
          </div>
          

          <div className="request-side-panel">
            <div className="side-card">
              <h3>
                Adjuntar
                documentación
              </h3>

              <select
                value={
                  selectedCategory
                }
                onChange={(e) =>
                  setSelectedCategory(
                    e.target.value
                  )
                }
              >
                {uploadCategories.map(
                  (category) => (
                    <option
                      key={category}
                    >
                      {category}
                    </option>
                  )
                )}
              </select>

              <input
                type="file"
                onChange={(e) =>
                  setSelectedFile(
                    e.target.files[0]
                  )
                }
              />

              <button
                className="primary-button"
                onClick={
                  handleUpload
                }
              >
                Subir archivo
              </button>
            </div>

            <div className="side-card">
              <h3>Timeline</h3>
              <div className="timeline">
                {request.history?.length === 0 ? (
                  <p className="empty-message">
                    Sin movimientos registrados.
                  </p>
                ) : (
                  [...request.history]
                    .reverse()
                    .map((item) => {
                      let timelineClass = "timeline-default";

                      if (item.action?.includes("Finalizada")) {
                        timelineClass = "timeline-success";
                      } else if (item.action?.includes("Faltan datos")) {
                        timelineClass = "timeline-warning";
                      } else if (item.action?.includes("Rechazada")) {
                        timelineClass = "timeline-danger";
                      } else if (item.action?.includes("Adjuntó archivo")) {
                        timelineClass = "timeline-info";
                      }

                      return (
                        <div
                          key={item.id}
                          className={`timeline-item ${timelineClass}`}
                        >
                          <div className="timeline-dot" />

                          <div className="timeline-content">
                            <strong>{item.action}</strong>
                            <p>{item.user}</p>
                            <span>{item.createdAt}</span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="detail-section">
          <h3>
            Comentarios
          </h3>

          <div className="comments-list">
            {request.comments?.length >
            0 ? (
              request.comments.map(
                (item) => (
                  <div
                    key={item.id}
                    className="comment-card"
                  >
                    <strong>
                      {
                        item.author
                      }
                    </strong>

                    <p>
                      {
                        item.comment
                      }
                    </p>

                    <span className="comment-date">
                      {
                        item.createdAt
                      }
                    </span>
                  </div>
                )
              )
            ) : (
              <div className="empty-box">
                No hay comentarios
              </div>
            )}
          </div>

          <div className="comment-box">
            <textarea
              placeholder="Escribir comentario..."
              value={comment}
              onChange={(e) =>
                setComment(
                  e.target.value
                )
              }
            />

            <button
              className="primary-button"
              onClick={
                handleAddComment
              }
            >
              Enviar comentario
            </button>
          </div>
        </div>
        {showDocsRequest && (
  <div className="modal-overlay">
    <div className="modal small-modal">
      <div className="modal-header">
        <div>
          <h2>Solicitar documentación</h2>
          <p>Seleccioná qué información falta para continuar.</p>
        </div>

        <button onClick={() => setShowDocsRequest(false)}>×</button>
      </div>

      <div className="docs-checklist">
        {[
          "Alta ARCA / ex AFIP",
          "Rentas Provincial",
          "CM 05",
          "Boleta de servicio",
          "Foto local interior",
          "Foto frente exterior",
          "Constancia bancaria",
          "CUIT actualizado",
        ].map((doc) => (
          <label key={doc} className="trip-checkbox">
            <input
              type="checkbox"
              checked={missingDocs.includes(doc)}
              onChange={() => toggleMissingDoc(doc)}
            />
            {doc}
          </label>
        ))}
      </div>

      <textarea
        className="trip-textarea"
        placeholder="Otro documento o comentario adicional..."
        value={customMissingDoc}
        onChange={(event) => setCustomMissingDoc(event.target.value)}
      />

      <div className="modal-footer">
        <button
          className="secondary-button"
          onClick={() => setShowDocsRequest(false)}
        >
          Cancelar
        </button>

        <button
          className="primary-button"
          onClick={handleRequestDocumentation}
        >
          Solicitar al cliente
        </button>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}
export default RequestDetail;