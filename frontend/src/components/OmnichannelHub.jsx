import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function OmnichannelHub({ user }) {
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState({
    channel: "WhatsApp",
    client: "",
    contact_name: "",
    phone: "",
    email: "",
    segment: "General",
    message: "",
    assigned_to: user?.name || "",
  });

  useEffect(() => {
    loadInbox();
  }, []);

  async function loadInbox() {
    try {
      const res = await fetch(`${API_URL}/api/omnichannel/inbox?status=all`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setMessages([]);
    }
  }

  async function simulateLead(event) {
    event.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/public/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo crear lead");
      alert(`Lead omnicanal creado: oportunidad #${data.opportunityId}`);
      setForm({ ...form, client: "", contact_name: "", phone: "", email: "", message: "" });
      await loadInbox();
    } catch (error) {
      console.error(error);
      alert(error.message || "Error creando lead omnicanal");
    }
  }

  return (
    <section className="module-page omnichannel-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Centro de contacto</p>
          <h1>Omnicanalidad</h1>
          <p className="module-subtitle">
            Hub preparado para recibir leads desde WhatsApp, web, ecommerce, formularios y futuros conectores.
          </p>
        </div>
        <button className="secondary-button" onClick={loadInbox}>Actualizar</button>
      </div>

      <div className="omni-grid">
        <div className="table-card omni-card">
          <h3>Simular ingreso de lead</h3>
          <p className="muted">Este formulario representa lo que después llega desde Webhook/Wizbot/Meta API.</p>
          <form className="campaign-form" onSubmit={simulateLead}>
            <label>Canal
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option>WhatsApp</option>
                <option>Web</option>
                <option>Instagram</option>
                <option>Facebook</option>
                <option>Email</option>
                <option>Ecommerce</option>
              </select>
            </label>
            <label>Cliente
              <input required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            </label>
            <label>Contacto
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </label>
            <label>Teléfono
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label>Email
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>Segmento
              <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
                <option>General</option>
                <option>Ciclismo</option>
                <option>Motopartes</option>
                <option>Movilidad Eléctrica</option>
                <option>Autopartes</option>
              </select>
            </label>
            <label className="full">Mensaje
              <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </label>
            <button className="primary-button">Crear lead CRM</button>
          </form>
        </div>

        <div className="table-card omni-card">
          <h3>Inbox omnicanal</h3>
          <div className="omni-list">
            {messages.length === 0 ? <p className="muted">Sin mensajes.</p> : messages.map((msg) => (
              <div className="omni-message" key={msg.id}>
                <div>
                  <strong>{msg.client || msg.contact_name}</strong>
                  <span>{msg.channel} · {msg.status}</span>
                </div>
                <p>{msg.message}</p>
                {msg.opportunity_id && <small>Oportunidad #{msg.opportunity_id}</small>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
