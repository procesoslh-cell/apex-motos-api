import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const emptyUser = {
  username: "",
  password: "",
  name: "",
  email: "",
  role: "vendedor",
  business_unit: "",
  supervisor_id: "",
  odoo_user_id: "",
};

function UsersModal({
  users,
  onClose,
  onCreateUser,
  onToggleUser,
}) {
  const [newUser, setNewUser] = useState(emptyUser);
  const [odooUsers, setOdooUsers] = useState([]);

  useEffect(() => {
    loadOdooUsers();
  }, []);

  async function loadOdooUsers() {
    try {
      const response = await fetch(`${API_URL}/api/odoo/vendedores`);
      const data = await response.json();

      setOdooUsers(data || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCreate() {
    if (!newUser.username || !newUser.password || !newUser.name) {
      alert("Completá los campos obligatorios");
      return;
    }

    await onCreateUser({
      ...newUser,
      supervisor_id: newUser.supervisor_id || null,
      odoo_user_id: newUser.odoo_user_id || null,
    });

    setNewUser(emptyUser);
  }

  const supervisors = users.filter(
    (user) => user.role === "supervisor" || user.role === "admin"
  );

  return (
    <div className="modal-overlay">
      <div className="modal users-modal">
        <div className="modal-header">
          <div>
            <h2>Administración de usuarios</h2>
            <p>Gestión de accesos, permisos y vínculo con Odoo</p>
          </div>

          <button onClick={onClose}>×</button>
        </div>

        <div className="users-layout">
          <div className="user-create-card">
            <h3>Crear usuario</h3>

            <div className="user-form">
              <label>
                Usuario
                <input
                  value={newUser.username}
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      username: event.target.value,
                    })
                  }
                  placeholder="Usuario login"
                />
              </label>

              <label>
                Contraseña
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      password: event.target.value,
                    })
                  }
                  placeholder="Contraseña"
                />
              </label>

              <label>
                Nombre completo
                <input
                  value={newUser.name}
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      name: event.target.value,
                    })
                  }
                  placeholder="Nombre"
                />
              </label>

              <label>
                E-mail
                <input
                  value={newUser.email}
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      email: event.target.value,
                    })
                  }
                  placeholder="mail@empresa.com"
                />
              </label>

              <label>
                Rol
                <select
                  value={newUser.role}
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      role: event.target.value,
                    })
                  }
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="cuentas">Cuentas Corrientes</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>

              <label>
                Unidad de negocio
                <select
                  value={newUser.business_unit}
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      business_unit: event.target.value,
                    })
                  }
                >
                  <option value="">Sin definir</option>
                  <option value="Ciclismo">Ciclismo</option>
                  <option value="Motociclismo">Motociclismo</option>
                </select>
              </label>

              {newUser.role === "vendedor" && (
                <label>
                  Supervisor asignado
                  <select
                    value={newUser.supervisor_id}
                    onChange={(event) =>
                      setNewUser({
                        ...newUser,
                        supervisor_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Sin supervisor</option>

                    {supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {["vendedor", "supervisor", "admin"].includes(newUser.role) && (
                <label>
                  Usuario Odoo vinculado
                  <select
                    value={newUser.odoo_user_id}
                    onChange={(event) =>
                      setNewUser({
                        ...newUser,
                        odoo_user_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Sin vincular</option>

                    {odooUsers.map((odooUser) => (
                      <option
                        key={odooUser.odoo_user_id}
                        value={odooUser.odoo_user_id}
                      >
                        {odooUser.vendedor} · {odooUser.login} · {odooUser.clientes_asignados} clientes
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                className="primary-button"
                onClick={handleCreate}
              >
                Crear usuario
              </button>
            </div>
          </div>

          <div className="users-table-card">
            <div className="users-table-header">
              <h3>Usuarios activos</h3>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Negocio</th>
                  <th>Odoo</th>
                  <th>Email</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.name}</td>

                    <td>
                      <span className="role-pill">
                        {user.role}
                      </span>
                    </td>

                    <td>{user.business_unit || "-"}</td>
                    <td>{user.odoo_user_id || "-"}</td>
                    <td>{user.email}</td>

                    <td>
                      {user.active ? (
                        <span className="status-pill status-green">
                          Activo
                        </span>
                      ) : (
                        <span className="status-pill status-red">
                          Inactivo
                        </span>
                      )}
                    </td>

                    <td>
                      <button
                        className="view-btn"
                        onClick={() => onToggleUser(user.id)}
                      >
                        {user.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="empty-box">
                No hay usuarios cargados
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UsersModal;