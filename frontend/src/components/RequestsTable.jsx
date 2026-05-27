function RequestsTable({
  requests,
  getSLA,
  getHoursOpen,
  getStatusClass,
  onSelectRequest,
}) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>SOLICITUD</th>
            <th>CLIENTE</th>
            <th>SOLICITANTE</th>
            <th>ESTADO</th>
            <th>HORAS</th>
            <th>SLA</th>
            <th>ACCIÓN</th>
          </tr>
        </thead>

        <tbody>
          {requests.map((request) => {
            const sla = getSLA(request);

            return (
              <tr key={request.id}>
                <td>#{request.id}</td>

                <td>{request.type}</td>

                <td>{request.client}</td>

                <td>{request.requester}</td>

                <td>
                  <span
                    className={`status-pill ${getStatusClass(
                      request.status
                    )}`}
                  >
                    {request.status}
                  </span>
                </td>

                <td>
                  {getHoursOpen(request) === "-"
                    ? "-"
                    : `${getHoursOpen(request)}hs`}
                </td>

                <td>
                  <span
                    className={`sla-pill ${sla.className}`}
                  >
                    {sla.text}
                  </span>
                </td>

                <td>
                  <button
                    className="view-btn"
                    onClick={() =>
                      onSelectRequest(request)
                    }
                  >
                    Ver solicitud
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {requests.length === 0 && (
        <div className="empty-table">
          <h3>
            No hay solicitudes
          </h3>

          <p>
            No se encontraron
            resultados para los
            filtros seleccionados.
          </p>
        </div>
      )}
    </div>
  );
}

export default RequestsTable;