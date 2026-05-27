import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const emptyForm = {
  type: "Alta de cliente",
  fantasyName: "",
  businessName: "",
  cuit: "",
  email: "",
  mobile: "",
  postalCodeCity: "",
  storeAddress: "",
  deliveryAddress: "",
  description: "",
  dueDate: "",

  odooClientId: "",
  odooClientName: "",

  invoiceId: "",
  invoiceName: "",
  invoiceAmount: "",

  quotationId: "",
  quotationName: "",
  quotationAmount: "",
};

const emptyFiles = {
  arca: null,
  rentas: null,
  cm05: null,
  servicio: null,
  interior: null,
  exterior: null,

  facturaAdjunta: null,
  presupuestoAdjunto: null,
};

function NewRequestModal({ onClose, onCreate, currentUser }) {
  const [formData, setFormData] = useState(emptyForm);
  const [files, setFiles] = useState(emptyFiles);
  const [saving, setSaving] = useState(false);

  const [clientes, setClientes] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [clientSearch, setClientSearch] = useState("");

  const isAltaCliente = formData.type === "Alta de cliente";
  const isNotaCredito = formData.type === "Nota de crédito";
  const isLimiteCredito = formData.type === "Límite de crédito";

  useEffect(() => {
    if (clientSearch.trim().length >= 3) {
      searchClientes(clientSearch.trim());
    } else {
      setClientes([]);
    }
  }, [clientSearch]);

  useEffect(() => {
    if (formData.odooClientId && isNotaCredito) {
      loadFacturas(formData.odooClientId);
    }

    if (formData.odooClientId && isLimiteCredito) {
      loadPresupuestos(formData.odooClientId);
    }
  }, [formData.odooClientId, formData.type]);

  async function searchClientes(search) {
    try {
      const response = await fetch(
        `${API_URL}/api/odoo/clientes/search?q=${encodeURIComponent(
          search
        )}&odoo_user_id=${currentUser?.odoo_user_id || ""}&role=${
          currentUser?.role || ""
        }`
      );

      const data = await response.json();

      setClientes(data || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadFacturas(clienteId) {
    try {
      const response = await fetch(
        `${API_URL}/api/odoo/facturas?clienteId=${clienteId}`
      );

      const data = await response.json();

      setFacturas(data || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadPresupuestos(clienteId) {
    try {
      const response = await fetch(
        `${API_URL}/api/odoo/presupuestos?clienteId=${clienteId}`
      );

      const data = await response.json();

      setPresupuestos(data || []);
    } catch (error) {
      console.error(error);
    }
  }

  function handleTypeChange(type) {
    setFormData({
      ...emptyForm,
      type,
    });

    setClientSearch("");
    setClientes([]);
    setFacturas([]);
    setPresupuestos([]);
  }

  function handleClientChange(clienteId) {
    const cliente = clientes.find(
      (item) => String(item.cliente_id) === String(clienteId)
    );

    setFormData({
      ...formData,
      odooClientId: clienteId,
      odooClientName: cliente?.cliente || "",
      fantasyName: cliente?.cliente || "",
      businessName: cliente?.cliente || "",
      cuit: cliente?.cuit || "",
      invoiceId: "",
      invoiceName: "",
      invoiceAmount: "",
      quotationId: "",
      quotationName: "",
      quotationAmount: "",
    });

    setClientSearch(cliente?.cliente || "");
    setFacturas([]);
    setPresupuestos([]);
  }

  function handleInvoiceChange(invoiceId) {
    const factura = facturas.find(
      (item) => String(item.factura_id) === String(invoiceId)
    );

    setFormData({
      ...formData,
      invoiceId,
      invoiceName: factura?.factura || "",
      invoiceAmount: factura?.monto || "",
    });
  }

  function handleQuotationChange(quotationId) {
    const presupuesto = presupuestos.find(
      (item) => String(item.presupuesto_id) === String(quotationId)
    );

    setFormData({
      ...formData,
      quotationId,
      quotationName: presupuesto?.presupuesto || "",
      quotationAmount: presupuesto?.monto || "",
    });
  }

  async function handleCreate() {
    if (isAltaCliente) {
      if (!formData.fantasyName && !formData.businessName) {
        alert("Completá nombre de fantasía o razón social");
        return;
      }

      if (!formData.cuit) {
        alert("Completá CUIT");
        return;
      }
    }

    if (isNotaCredito) {
      if (!formData.odooClientId) {
        alert("Seleccioná un cliente");
        return;
      }

      if (!formData.invoiceId) {
        alert("Seleccioná una factura");
        return;
      }

      if (!formData.description.trim()) {
        alert("Completá el motivo u observación");
        return;
      }
    }

    if (isLimiteCredito) {
      if (!formData.odooClientId) {
        alert("Seleccioná un cliente");
        return;
      }

      if (!formData.quotationId) {
        alert("Seleccioná un presupuesto");
        return;
      }

      if (!formData.description.trim()) {
        alert("Completá la observación de la solicitud");
        return;
      }
    }

    const detailDescription = [
      formData.description,
      isNotaCredito
        ? `
Cliente Odoo: ${formData.odooClientName}
Factura: ${formData.invoiceName}
Monto factura: $${Number(formData.invoiceAmount || 0).toLocaleString("es-AR")}
Flujo: requiere aprobación de supervisor antes de pasar a Cuentas Corrientes.
`
        : "",
      isLimiteCredito
        ? `
Cliente Odoo: ${formData.odooClientName}
Presupuesto: ${formData.quotationName}
Monto presupuesto: $${Number(formData.quotationAmount || 0).toLocaleString(
            "es-AR"
          )}
`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    setSaving(true);

    await onCreate({
      formData: {
        ...formData,
        client:
          formData.odooClientName ||
          formData.fantasyName ||
          formData.businessName,
        description: detailDescription,
      },
      files,
    });

    setSaving(false);
  }

  function renderClienteSelector() {
    return (
      <>
        <label className="full">
          Buscar cliente
          <input
            className="search-input"
            value={clientSearch}
            onChange={(event) => {
              setClientSearch(event.target.value);

              setFormData({
                ...formData,
                odooClientId: "",
                odooClientName: "",
                invoiceId: "",
                invoiceName: "",
                invoiceAmount: "",
                quotationId: "",
                quotationName: "",
                quotationAmount: "",
              });

              setFacturas([]);
              setPresupuestos([]);
            }}
            placeholder="Escribí al menos 3 letras del cliente..."
          />
        </label>

        <label className="full">
          Cliente encontrado
          <select
            value={formData.odooClientId}
            onChange={(event) => handleClientChange(event.target.value)}
            disabled={clientes.length === 0}
          >
            <option value="">
              {clientSearch.length < 3
                ? "Buscá un cliente primero"
                : clientes.length === 0
                ? "Sin resultados"
                : "Seleccionar cliente"}
            </option>

            {clientes.map((cliente) => (
              <option key={cliente.cliente_id} value={cliente.cliente_id}>
                {cliente.cliente}
                {cliente.cuit ? ` · ${cliente.cuit}` : ""}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal new-request-modal">
        <div className="modal-header">
          <div>
            <h2>Nueva solicitud</h2>
            <p>Gestión operativa según tipo de solicitud</p>
          </div>

          <button onClick={onClose}>×</button>
        </div>

        <div className="modal-section-title">Información general</div>

        <div className="form-grid">
          <label>
            Tipo de solicitud
            <select
              value={formData.type}
              onChange={(event) => handleTypeChange(event.target.value)}
            >
              <option>Alta de cliente</option>
              <option>Nota de crédito</option>
              <option>Límite de crédito</option>
              <option>Domicilio de entrega</option>
              <option>Papeles fiscales</option>
            </select>
          </label>

          <label>
            Fecha objetivo
            <input
              type="date"
              value={formData.dueDate}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  dueDate: event.target.value,
                })
              }
            />
          </label>
        </div>

        {isAltaCliente && (
          <>
            <div className="modal-section-title">Alta de cliente</div>

            <div className="form-grid">
              <label>
                Nombre de fantasía
                <input
                  value={formData.fantasyName}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      fantasyName: event.target.value,
                    })
                  }
                  placeholder="Ej: Moto Repuestos Centro"
                />
              </label>

              <label>
                Razón social
                <input
                  value={formData.businessName}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      businessName: event.target.value,
                    })
                  }
                  placeholder="Ej: 30 DE NOVIEMBRE SRL"
                />
              </label>

              <label>
                CUIT
                <input
                  value={formData.cuit}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      cuit: event.target.value,
                    })
                  }
                  placeholder="Ej: 30-71100679-2"
                />
              </label>

              <label>
                E-mail
                <input
                  value={formData.email}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      email: event.target.value,
                    })
                  }
                  placeholder="cliente@email.com"
                />
              </label>

              <label>
                Celular de contacto
                <input
                  value={formData.mobile}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      mobile: event.target.value,
                    })
                  }
                  placeholder="+54 9 ..."
                />
              </label>

              <label>
                Código Postal y Ciudad
                <input
                  value={formData.postalCodeCity}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      postalCodeCity: event.target.value,
                    })
                  }
                  placeholder="Ej: 5000 Córdoba"
                />
              </label>

              <label className="full">
                Dirección del local
                <input
                  value={formData.storeAddress}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      storeAddress: event.target.value,
                    })
                  }
                  placeholder="Dirección fiscal/local"
                />
              </label>

              <label className="full">
                Dirección de entrega
                <input
                  value={formData.deliveryAddress}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      deliveryAddress: event.target.value,
                    })
                  }
                  placeholder="Completar si es distinta a la fiscal"
                />
              </label>

              <label className="full">
                Observaciones
                <textarea
                  rows="4"
                  value={formData.description}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      description: event.target.value,
                    })
                  }
                  placeholder="Comentarios adicionales..."
                />
              </label>
            </div>

            <div className="modal-section-title">Documentación impositiva</div>

            <div className="upload-grid">
              <label className="upload-card">
                <strong>Alta ARCA / ex AFIP</strong>
                <span>PDF, JPG o PNG</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setFiles({
                      ...files,
                      arca: event.target.files[0],
                    })
                  }
                />
              </label>

              <label className="upload-card">
                <strong>Rentas Provincial</strong>
                <span>Constancia actualizada</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setFiles({
                      ...files,
                      rentas: event.target.files[0],
                    })
                  }
                />
              </label>

              <label className="upload-card">
                <strong>CM 05</strong>
                <span>Solo si corresponde</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setFiles({
                      ...files,
                      cm05: event.target.files[0],
                    })
                  }
                />
              </label>

              <label className="upload-card">
                <strong>Boleta de servicio</strong>
                <span>Si entrega difiere de fiscal</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setFiles({
                      ...files,
                      servicio: event.target.files[0],
                    })
                  }
                />
              </label>
            </div>

            <div className="modal-section-title">Fotos del establecimiento</div>

            <div className="upload-grid">
              <label className="upload-card">
                <strong>Foto local interior</strong>
                <span>JPG o PNG</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(event) =>
                    setFiles({
                      ...files,
                      interior: event.target.files[0],
                    })
                  }
                />
              </label>

              <label className="upload-card">
                <strong>Foto frente exterior</strong>
                <span>JPG o PNG</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(event) =>
                    setFiles({
                      ...files,
                      exterior: event.target.files[0],
                    })
                  }
                />
              </label>
            </div>
          </>
        )}

        {isNotaCredito && (
  <>
    <div className="modal-section-title">
      Nota de crédito
    </div>

    <div className="form-grid">
      {renderClienteSelector()}

      <label className="full">
        Factura

        <select
          value={formData.invoiceId}
          onChange={(event) =>
            handleInvoiceChange(event.target.value)
          }
          disabled={!formData.odooClientId}
        >
          <option value="">
            {!formData.odooClientId
              ? "Seleccioná un cliente primero"
              : facturas.length === 0
              ? "Sin facturas disponibles"
              : "Seleccionar factura"}
          </option>

          {facturas.map((factura) => (
            <option
              key={factura.factura_id}
              value={factura.factura_id}
            >
              {factura.factura} · $
              {Number(
                factura.monto || 0
              ).toLocaleString("es-AR")}
            </option>
          ))}
        </select>
      </label>

      <label>
        Monto factura

        <input
          value={
            formData.invoiceAmount
              ? `$ ${Number(
                  formData.invoiceAmount
                ).toLocaleString("es-AR")}`
              : ""
          }
          readOnly
          placeholder="Monto automático"
        />
      </label>

      <label className="full">
        Motivo / observaciones

        <textarea
          rows="5"
          value={formData.description}
          onChange={(event) =>
            setFormData({
              ...formData,
              description: event.target.value,
            })
          }
          placeholder="Explicá el motivo de la nota de crédito..."
        />
      </label>
    </div>

    <div className="modal-section-title">
      Adjuntos
    </div>

    <div className="upload-grid">
      <label className="upload-card">
        <strong>
          Factura / comprobante
        </strong>

        <span>
          PDF, JPG o PNG
        </span>

        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(event) =>
            setFiles({
              ...files,
              facturaAdjunta:
                event.target.files[0],
            })
          }
        />
      </label>
    </div>
  </>
)}

        {isLimiteCredito && (
          <>
            <div className="modal-section-title">Solicitud de crédito</div>

            <div className="form-grid">
              {renderClienteSelector()}

              <label className="full">
                Presupuesto
                <select
                  value={formData.quotationId}
                  onChange={(event) => handleQuotationChange(event.target.value)}
                  disabled={!formData.odooClientId}
                >
                  <option value="">
                    {!formData.odooClientId
                      ? "Seleccioná un cliente primero"
                      : presupuestos.length === 0
                      ? "Sin presupuestos disponibles"
                      : "Seleccionar presupuesto"}
                  </option>

                  {presupuestos.map((presupuesto) => (
                    <option
                      key={presupuesto.presupuesto_id}
                      value={presupuesto.presupuesto_id}
                    >
                      {presupuesto.presupuesto} · $
                      {Number(presupuesto.monto || 0).toLocaleString("es-AR")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Monto presupuesto
                <input
                  value={
                    formData.quotationAmount
                      ? `$ ${Number(formData.quotationAmount).toLocaleString(
                          "es-AR"
                        )}`
                      : ""
                  }
                  readOnly
                  placeholder="Monto automático"
                />
              </label>

              <label className="full">
                Observaciones
                <textarea
                  rows="5"
                  value={formData.description}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      description: event.target.value,
                    })
                  }
                  placeholder="Indicar motivo de la solicitud de crédito..."
                />
              </label>
            </div>
          </>
        )}

        {!isAltaCliente && !isNotaCredito && !isLimiteCredito && (
          <div className="form-grid">
            <label className="full">
              Observaciones
              <textarea
                rows="5"
                value={formData.description}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    description: event.target.value,
                  })
                }
                placeholder="Detalle de la solicitud..."
              />
            </label>
          </div>
        )}

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>
            Cancelar
          </button>

          <button
            className="primary-button"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? "Creando..." : "Crear solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewRequestModal;