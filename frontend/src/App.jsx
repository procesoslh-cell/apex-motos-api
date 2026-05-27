import { useEffect, useMemo, useState } from "react";
import "./App.css";
import CommercialDashboard from "./components/CommercialDashboard";
import Trips from "./components/Trips";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import RequestsTable from "./components/RequestsTable";
import RequestDetail from "./components/RequestDetail";
import NewRequestModal from "./components/NewRequestModal";
import UsersModal from "./components/UsersModal";
import NotificationsModal from "./components/NotificationsModal";
import CommercialRadiography from "./components/CommercialRadiography";
import Collections from "./components/Collections";
import CollectionsAdmin from "./components/CollectionsAdmin";
import CRM from "./components/CRM";
import Campaigns from "./components/Campaigns";
import OmnichannelHub from "./components/OmnichannelHub";
import SalesBudget from "./components/SalesBudget";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [showWelcomeNotifications, setShowWelcomeNotifications] =
  useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [typeFilter, setTypeFilter] = useState("Todas");

  const [currentView, setCurrentView] = useState("requests");

  useEffect(() => {
    const savedUser = localStorage.getItem("crm_user");

    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);

        setCurrentUser(user);

        loadRequests();
        loadNotifications(user);
        setTimeout(async () => {
  const response = await fetch(
    `${API_URL}/api/notifications?role=${user.role}&name=${encodeURIComponent(
      user.name
    )}`
  );

  const data = await response.json();

  const unread = (data || []).filter(
    (item) => !item.isRead
  );

  if (unread.length > 0) {
    setShowWelcomeNotifications(true);
  }
}, 500);

        if (user.role === "admin") {
          loadUsers();
        }
      } catch {
        localStorage.removeItem("crm_user");
      }
    } else {
      loadRequests();
    }
  }, []);

  async function loadRequests() {
    try {
      const response = await fetch(`${API_URL}/api/requests`);
      const data = await response.json();

      setRequests(data || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadUsers() {
    try {
      const response = await fetch(`${API_URL}/api/users`);
      const data = await response.json();

      setUsers(data || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadNotifications(user = currentUser) {
    if (!user) return;

    try {
      await fetch(`${API_URL}/api/notifications/check-sla`, {
        method: "POST",
      });

      await fetch(`${API_URL}/api/notifications/check-crm-alerts`, {
        method: "POST",
      });

      await fetch(`${API_URL}/api/notifications/check-trip-alerts`, {
        method: "POST",
      });

      await fetch(`${API_URL}/api/notifications/check-sales-alerts`, {
        method: "POST",
      });

      const response = await fetch(
        `${API_URL}/api/notifications?role=${user.role}&name=${encodeURIComponent(
          user.name
        )}`
      );

      const data = await response.json();

      setNotifications(data || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleLogin(loginData) {
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      if (!response.ok) {
        alert("Usuario o contraseña incorrectos");
        return;
      }

      const user = await response.json();

      setCurrentUser(user);
      localStorage.setItem("crm_user", JSON.stringify(user));

      await loadRequests();
      await loadNotifications(user);
      setTimeout(async () => {
  const response = await fetch(
    `${API_URL}/api/notifications?role=${user.role}&name=${encodeURIComponent(
      user.name
    )}`
  );

  const data = await response.json();

  const unread = (data || []).filter(
    (item) => !item.isRead
  );

  if (unread.length > 0) {
    setShowWelcomeNotifications(true);
  }
}, 500);

      if (user.role === "admin") {
        await loadUsers();
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo iniciar sesión");
    }
  }

  function logout() {
    localStorage.removeItem("crm_user");

    setCurrentUser(null);
    setSelectedRequest(null);
    setNotifications([]);
    setTypeFilter("Todas");
    setStatusFilter("Todos");
    setSearch("");
    setCurrentView("requests");
  }

  async function uploadFile(requestId, file, category) {
    if (!file) return;

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("category", category);
      formData.append("user", currentUser.name);

      await fetch(`${API_URL}/api/requests/${requestId}/files`, {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function createRequest({ formData, files }) {
    try {
      const payload = {
        ...formData,
        client: formData.fantasyName || formData.businessName,
        requester: currentUser.name,
        area: "Cuentas Corrientes",
        priority: "Alta",
      };

      const response = await fetch(`${API_URL}/api/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        alert("Error creando solicitud");
        return;
      }

      const created = await response.json();

      setShowNewRequest(false);

      await loadRequests();
      await loadNotifications();

      Promise.allSettled([
  uploadFile(created.id, files.arca, "Alta ARCA / ex AFIP"),
  uploadFile(created.id, files.rentas, "Rentas Provincial"),
  uploadFile(created.id, files.cm05, "CM 05"),
  uploadFile(created.id, files.servicio, "Boleta de servicio"),
  uploadFile(created.id, files.interior, "Foto local interior"),
  uploadFile(created.id, files.exterior, "Foto frente exterior"),

  uploadFile(created.id, files.facturaAdjunta, "Factura adjunta"),
  uploadFile(created.id, files.presupuestoAdjunto, "Presupuesto adjunto"),
]).then(async () => {
  await loadRequests();
  await loadNotifications();
});
    } catch (error) {
      console.error(error);
      alert("Error creando solicitud");
    }
  }

  async function refreshSelectedRequest(requestId) {
    try {
      const response = await fetch(`${API_URL}/api/requests`);
      const data = await response.json();

      setRequests(data || []);

      const updated = data.find((item) => item.id === requestId);

      if (updated) {
        setSelectedRequest(updated);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function addComment(requestId, comment) {
    if (!comment.trim()) return;

    try {
      await fetch(`${API_URL}/api/requests/${requestId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          author: currentUser.name,
          comment,
        }),
      });

      await refreshSelectedRequest(requestId);
      await loadNotifications();
    } catch (error) {
      console.error(error);
    }
  }

  async function updateStatus(requestId, status) {
    try {
      await fetch(`${API_URL}/api/requests/${requestId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          user: currentUser.name,
        }),
      });

      await refreshSelectedRequest(requestId);
      await loadNotifications();
    } catch (error) {
      console.error(error);
    }
  }

  async function uploadFileToExistingRequest(requestId, file, category) {
    try {
      await uploadFile(requestId, file, category);

      await refreshSelectedRequest(requestId);
      await loadNotifications();
    } catch (error) {
      console.error(error);
    }
  }

  async function createUser(newUser) {
  try {
    const response = await fetch(`${API_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newUser),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "No se pudo crear el usuario");
      return;
    }

    await loadUsers();
  } catch (error) {
    console.error(error);
    alert("Error creando usuario");
  }
}

  async function toggleUser(userId) {
    try {
      await fetch(`${API_URL}/api/users/${userId}/toggle`, {
        method: "PATCH",
      });

      await loadUsers();
    } catch (error) {
      console.error(error);
    }
  }

  async function openNotification(notification) {
    try {
      if (!notification.isRead) {
        await fetch(`${API_URL}/api/notifications/${notification.id}/read`, {
          method: "PATCH",
        });
      }

      const request = requests.find(
        (item) => item.id === notification.requestId
      );

      if (request) {
        setSelectedRequest(request);
      }

      setShowNotifications(false);

      await loadNotifications();
    } catch (error) {
      console.error(error);
    }
  }

  function isClosedStatus(status) {
    return [
      "Finalizada",
      "Validada",
      "Rechazada",
      "Cerrada",
      "Aprobada",
      "Cancelada",
      "Pendiente revisión",
    ].includes(status);
  }

  function getHoursOpen(request) {
    if (isClosedStatus(request.status)) {
      return "-";
    }

    const created = new Date(request.createdAt);
    const now = new Date();

    return Math.max(0, Math.floor((now - created) / 1000 / 60 / 60));
  }

  function getSLA(request) {
    if (isClosedStatus(request.status)) {
      return {
        text: "Cerrado",
        className: "sla-green",
      };
    }

    const hours = getHoursOpen(request);

    if (hours >= 72) {
      return {
        text: "Vencido",
        className: "sla-red",
      };
    }

    if (hours >= 48) {
      return {
        text: "Alerta",
        className: "sla-yellow",
      };
    }

    return {
      text: "En tiempo",
      className: "sla-green",
    };
  }

  function getStatusClass(status) {
    if (status === "Nueva") return "status-blue";
    if (status === "En revisión") return "status-yellow";
    if (status === "Faltan datos") return "status-orange";
    if (status === "Rechazada") return "status-red";
    if (status === "Finalizada") return "status-green";

    return "status-blue";
  }

  const visibleRequests = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === "vendedor") {
      return requests.filter(
        (request) => request.requester === currentUser.name
      );
    }

    return requests;
  }, [requests, currentUser]);

  const filteredRequests = useMemo(() => {
    const value = search.toLowerCase();

    return visibleRequests.filter((request) => {
      const text = `
        ${request.type || ""}
        ${request.client || ""}
        ${request.requester || ""}
        ${request.status || ""}
        ${request.cuit || ""}
      `.toLowerCase();

      const matchesSearch = text.includes(value);

      const matchesStatus =
        statusFilter === "Todos" || request.status === statusFilter;

      const matchesType =
        typeFilter === "Todas" || request.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [visibleRequests, search, statusFilter, typeFilter]);

  function downloadRequestsCSV() {
    const headers = [
      "ID",
      "Tipo",
      "Cliente",
      "Solicitante",
      "Estado",
      "Prioridad",
      "Horas abiertas",
      "SLA",
      "CUIT",
      "Email",
      "Celular",
      "Direccion local",
      "Direccion entrega",
      "Observaciones",
      "Fecha creacion",
    ];

    const rows = filteredRequests.map((request) => {
      const sla = getSLA(request);

      return [
        request.id,
        request.type,
        request.client,
        request.requester,
        request.status,
        request.priority,
        getHoursOpen(request),
        sla.text,
        request.cuit,
        request.email,
        request.mobile,
        request.storeAddress,
        request.deliveryAddress,
        request.description,
        request.createdAt,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const safeValue = String(value ?? "").replace(/"/g, '""');
            return `"${safeValue}"`;
          })
          .join(";")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `solicitudes-${currentUser.role}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function openRequestsView(filter = "Todas") {
    setCurrentView("requests");
    setTypeFilter(filter);
  }

  const unreadNotifications = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
  currentUser={currentUser}
  activeFilter={typeFilter}
  currentView={currentView}
  onFilterChange={openRequestsView}
  onOpenCommercial={() => setCurrentView("commercial")}
  onOpenTrips={() => setCurrentView("trips")}
  onOpenDashboard={() => setCurrentView("dashboard")}
  onOpenCRM={() => setCurrentView("crm")}
  onOpenCampaigns={() => setCurrentView("campaigns")}
  onOpenOmnichannel={() => setCurrentView("omnichannel")}
  onOpenSales={() => setCurrentView("sales")}
  onLogout={logout}
  onOpenCollections={() => setCurrentView("collections")}
  onOpenUsers={() => {
    loadUsers();
    setShowUsersPanel(true);
  }}
/>

<button
  className="mobile-logout-button"
  onClick={logout}
>
  Salir
</button>

      <main className="main-panel">
        {currentView === "commercial" && (
  <CommercialRadiography user={currentUser} />
)}

{currentView === "trips" && (
  <Trips user={currentUser} />
)}

{currentView === "collections" && (
  currentUser.role === "cuentas" ? (
    <CollectionsAdmin user={currentUser} />
  ) : (
    <Collections user={currentUser} />
  )
)}

{currentView === "dashboard" && (
  <CommercialDashboard />
)}
{currentView === "crm" && (
  <CRM user={currentUser} />
)}
{currentView === "campaigns" && (
  <Campaigns user={currentUser} />
)}

{currentView === "omnichannel" && (
  <OmnichannelHub user={currentUser} />
)}

{currentView === "sales" && (
  <SalesBudget user={currentUser} />
)}


{currentView === "requests" && (
  <>
    <header className="page-header">
              <div>
                <h1>
                  {currentUser.role === "vendedor"
                    ? "Mis solicitudes"
                    : currentUser.role === "cuentas"
                    ? "Bandeja operativa"
                    : "Panel de administración"}
                </h1>

                <p>
                  Gestión centralizada entre Comercial, Cuentas Corrientes y
                  Administración.
                </p>
              </div>

              <div className="header-actions">
                <button
                  className="secondary-button"
                  onClick={downloadRequestsCSV}
                >
                  Descargar
                </button>

                <button
                  className="notification-button"
                  onClick={() => setShowNotifications(true)}
                >
                  🔔

                  {unreadNotifications > 0 && (
                    <span className="notification-count">
                      {unreadNotifications}
                    </span>
                  )}
                </button>

                {currentUser.role !== "cuentas" && (
                  <button
                    className="primary-button"
                    onClick={() => setShowNewRequest(true)}
                  >
                    + Nueva solicitud
                  </button>
                )}
              </div>
            </header>

            <section className="stats-grid">
              <div className="stat-card">
                <span>Solicitudes visibles</span>
                <strong>{filteredRequests.length}</strong>
              </div>

              <div className="stat-card">
                <span>En revisión</span>

                <strong>
                  {
                    filteredRequests.filter(
                      (request) => request.status === "En revisión"
                    ).length
                  }
                </strong>
              </div>

              <div className="stat-card">
                <span>SLA vencido</span>

                <strong>
                  {
                    filteredRequests.filter(
                      (request) => getHoursOpen(request) >= 72
                    ).length
                  }
                </strong>
              </div>
            </section>

            <section className="filters-bar">
              <input
                className="search-input"
                placeholder="Buscar por cliente, CUIT, solicitante o estado..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select
                className="status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option>Todos</option>
                <option>Nueva</option>
                <option>En revisión</option>
                <option>Faltan datos</option>
                <option>Rechazada</option>
                <option>Finalizada</option>
              </select>
            </section>

            <RequestsTable
              requests={filteredRequests}
              getSLA={getSLA}
              getHoursOpen={getHoursOpen}
              getStatusClass={getStatusClass}
              onSelectRequest={setSelectedRequest}
            />
          </>
        )}
      </main>

      {showNewRequest && (
        <NewRequestModal
  onClose={() => setShowNewRequest(false)}
  onCreate={createRequest}
  currentUser={currentUser}
/>
      )}

      {selectedRequest && (
        <RequestDetail
          request={selectedRequest}
          currentUser={currentUser}
          getSLA={getSLA}
          getHoursOpen={getHoursOpen}
          getStatusClass={getStatusClass}
          onClose={() => setSelectedRequest(null)}
          onAddComment={addComment}
          onUpdateStatus={updateStatus}
          onUploadFile={uploadFileToExistingRequest}
        />
      )}

      {showUsersPanel && (
        <UsersModal
          users={users}
          onClose={() => setShowUsersPanel(false)}
          onCreateUser={createUser}
          onToggleUser={toggleUser}
        />
      )}

      {showNotifications && (
        <NotificationsModal
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onOpenNotification={openNotification}
        />
      )}
      {showWelcomeNotifications && (
  <div className="modal-overlay">
    <div className="modal small-modal">
      <div className="modal-header">
        <div>
          <h2>Notificaciones pendientes</h2>

          <p>
            Tenés {unreadNotifications} notificaciones sin leer.
          </p>
        </div>

        <button
          onClick={() =>
            setShowWelcomeNotifications(false)
          }
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        {notifications
          .filter((n) => !n.isRead)
          .slice(0, 5)
          .map((notification) => (
            <div
              key={notification.id}
              className="detail-box"
            >
              <strong>{notification.title}</strong>

              <p>{notification.message}</p>
            </div>
          ))}
      </div>

      <div className="modal-footer">
        <button
          className="secondary-button"
          onClick={() =>
            setShowWelcomeNotifications(false)
          }
        >
          Cerrar
        </button>

        <button
          className="primary-button"
          onClick={() => {
            setShowWelcomeNotifications(false);
            setShowNotifications(true);
          }}
        >
          Ver todas
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default App;