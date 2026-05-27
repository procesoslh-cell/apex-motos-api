import { useState } from "react";

function Login({ onLogin }) {
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  function handleSubmit(event) {
  event.preventDefault();

  onLogin({
    username: loginData.username.trim(),
    password: loginData.password.trim(),
  });
}

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="logo">GS</div>

        <div>
          <h1>Gestor de Solicitudes</h1>
          <p>Comercial · Cuentas Corrientes · Administración</p>
        </div>

        <input
          type="text"
          placeholder="Usuario"
          value={loginData.username}
          onChange={(event) =>
            setLoginData({
              ...loginData,
              username: event.target.value,
            })
          }
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={loginData.password}
          onChange={(event) =>
            setLoginData({
              ...loginData,
              password: event.target.value,
            })
          }
        />

        <button type="submit">Ingresar</button>

<div className="login-footer">
  <p>Diseñado y desarrollado por FR</p>
  <span>Lopez Hnos</span>
</div>
      </form>
    </div>
  );
}

export default Login;