function Sidebar({
  currentUser,
  activeFilter,
  currentView,
  onFilterChange,
  onOpenCommercial,
  onOpenTrips,
  onOpenDashboard,
  onLogout,
  onOpenUsers,
  onOpenCollections,
  onOpenCRM,
  onOpenCampaigns,
  onOpenOmnichannel,
  onOpenSales,
}) {
  const isCommercialUser = ["vendedor", "supervisor", "admin"].includes(
    currentUser.role
  );

 const canSeeRadiography = ["vendedor", "supervisor", "admin"].includes(
  currentUser.role
);

const canSeeManagement = ["supervisor", "admin"].includes(currentUser.role);

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-header">
          <div className="logo">GS</div>

          <div>
            <h2>Gestor</h2>

            <p>
              {currentUser.role === "vendedor" && "Comercial"}
              {currentUser.role === "cuentas" && "Cuentas Corrientes"}
              {currentUser.role === "supervisor" && "Supervisor Comercial"}
              {currentUser.role === "admin" && "Administrador"}
            </p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={
              currentView === "requests" && activeFilter === "Todas"
                ? "active"
                : ""
            }
            onClick={() => onFilterChange("Todas")}
          >
            Solicitudes
          </button>

          <button
            className={
              currentView === "requests" && activeFilter === "Alta de cliente"
                ? "active"
                : ""
            }
            onClick={() => onFilterChange("Alta de cliente")}
          >
            Altas clientes
          </button>

          <button
            className={
              currentView === "requests" && activeFilter === "Nota de crédito"
                ? "active"
                : ""
            }
            onClick={() => onFilterChange("Nota de crédito")}
          >
            Notas de crédito
          </button>

          <button
            className={
              currentView === "requests" && activeFilter === "Límite de crédito"
                ? "active"
                : ""
            }
            onClick={() => onFilterChange("Límite de crédito")}
          >
            Límites crédito
          </button>

          <button
            className={
              currentView === "requests" && activeFilter === "Informes"
                ? "active"
                : ""
            }
            onClick={() => onFilterChange("Informes")}
          >
            Informes
          </button>

          {canSeeRadiography && (
            <button
              className={currentView === "commercial" ? "active" : ""}
              onClick={onOpenCommercial}
            >
              Radiografía Comercial
            </button>
          )}

          {isCommercialUser && (
            <button
              className={currentView === "trips" ? "active" : ""}
              onClick={onOpenTrips}
            >
              Giras comerciales
            </button>
          )}
          <button
  className={currentView === "collections" ? "active" : ""}
  onClick={onOpenCollections}
>
  Cobranzas
</button>

          {canSeeManagement && (
            <button
              className={currentView === "dashboard" ? "active" : ""}
              onClick={onOpenDashboard}
            >
              Panel de control comercial
            </button>
          )}

          <button
  className={
    currentView === "crm"
      ? "sidebar-link active"
      : "sidebar-link"
  }
  onClick={() => onOpenCRM()}
>
  CRM
</button>

          <button
            className={currentView === "sales" ? "active" : ""}
            onClick={onOpenSales}
          >
            Presupuestos
          </button>

          {canSeeManagement && (
            <button
              className={currentView === "campaigns" ? "active" : ""}
              onClick={onOpenCampaigns}
            >
              Campañas CRM
            </button>
          )}

          {canSeeManagement && (
            <button
              className={currentView === "omnichannel" ? "active" : ""}
              onClick={onOpenOmnichannel}
            >
              Omnicanalidad
            </button>
          )}


          {currentUser.role === "admin" && (
            <button onClick={onOpenUsers}>
              Administración usuarios
            </button>
          )}
        </nav>
      </div>

      <div className="sidebar-user">
        <div>
          <strong>{currentUser.name}</strong>
          <p>{currentUser.email}</p>
        </div>

        <button onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;