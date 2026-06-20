'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '../../components/Shell';
import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from '../../lib/api';

const emptyCustomer = {
  contact_id: '',
  customer_name: '',
  customer_phone: '',
  customer_document: '',
  customer_email: '',
  customer_address: '',
  seller: '',
  notes: '',
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return ymd(d);
}

function today() {
  return ymd(new Date());
}

function money(v: any) {
  return `$${Math.round(Number(v || 0)).toLocaleString('es-AR')}`;
}

function pct(v: any) {
  return `${Number(v || 0).toFixed(1)}%`;
}


export default function Ventas() {
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [type, setType] = useState('Presupuesto');
  const [pid, setPid] = useState('');
  const [q, setQ] = useState(1);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [payment, setPayment] = useState('Efectivo');
  const [discount, setDiscount] = useState(0);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [customer, setCustomer] = useState<any>(emptyCustomer);
  const [selected, setSelected] = useState<any | null>(null);
  const [edit, setEdit] = useState<any>({});
  const [dateFrom, setDateFrom] = useState(defaultFrom());
  const [dateTo, setDateTo] = useState(today());
  const [loadingProducts, setLoadingProducts] = useState(false);

  const salesQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    return p.toString();
  }, [dateFrom, dateTo]);

  const loadSales = async () => {
    const rows = await apiGet(`/sales?${salesQuery}`);
    setSales(rows);
  };

  const load = async () => {
    const [salesRows, contactRows] = await Promise.all([
      apiGet(`/sales?${salesQuery}`),
      apiGet('/contacts'),
    ]);
    setSales(salesRows);
    setContacts(contactRows);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadSales().catch((e: any) => setErr(e.message));
  }, [salesQuery]);

  useEffect(() => {
    const text = search.trim();
    setPid('');
    if (text.length < 2) {
      setProducts([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setLoadingProducts(true);
        const rows = await apiGet(`/products/search?q=${encodeURIComponent(text)}&limit=20`);
        setProducts(rows);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoadingProducts(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  function selectContact(id: string) {
    const c = contacts.find((x) => String(x.id) === String(id));
    setCustomer({
      ...customer,
      contact_id: id,
      customer_name: c?.name || '',
      customer_phone: c?.phone || '',
      customer_document: c?.document || '',
      customer_email: c?.email || '',
      customer_address: c?.address || '',
    });
  }

  function add(productId = pid) {
    const x = products.find((y) => String(y.id) === String(productId));
    if (!x) return;
    setCart([
      ...cart,
      {
        product_id: x.id,
        sku: x.sku,
        name: x.name,
        quantity: +q,
        unit_price: x.sale_price,
        total: +q * x.sale_price,
      },
    ]);
    setPid('');
    setQ(1);
  }

  function remove(i: number) {
    setCart(cart.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setErr('');
    setOk('');
    try {
      await apiPost('/sales', {
        type,
        payment_method: payment,
        discount: +discount,
        ...customer,
        contact_id: customer.contact_id ? +customer.contact_id : null,
        items: cart.map((c) => ({
          product_id: c.product_id,
          quantity: c.quantity,
          unit_price: c.unit_price,
        })),
      });
      setCart([]);
      setDiscount(0);
      setCustomer(emptyCustomer);
      await loadSales();
      setOk('Comprobante registrado.');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function openSale(s: any) {
    setErr('');
    setOk('');
    const d = await apiGet(`/sales/${s.id}`);
    setSelected(d);
    setEdit({
      payment_method: d.payment_method || 'Efectivo',
      seller: d.seller || '',
      notes: d.notes || '',
      customer_name: d.customer_name || '',
      customer_phone: d.customer_phone || '',
      customer_document: d.customer_document || '',
      customer_email: d.customer_email || '',
      customer_address: d.customer_address || '',
    });
  }

  async function saveSale() {
    if (!selected) return;
    setErr('');
    setOk('');
    try {
      const d = await apiPatch(`/sales/${selected.id}`, edit);
      setSelected(d);
      await loadSales();
      setOk('Comprobante actualizado sin modificar stock ni productos vendidos.');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function convertSale() {
    if (!selected) return;
    setErr('');
    setOk('');
    try {
      const d = await apiPatch(`/sales/${selected.id}/convert`, {});
      setSelected(d);
      await loadSales();
      setOk('Presupuesto convertido a pedido de venta. Se descontó stock.');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function deleteSale(s: any) {
    setErr('');
    setOk('');
    const msg = `¿Eliminar comprobante #${s.id}?\n\nSi es una venta registrada, se devolverá el stock de los productos. Esta acción no se puede deshacer.`;
    if (!window.confirm(msg)) return;
    try {
      await apiDelete(`/sales/${s.id}`);
      if (selected?.id === s.id) setSelected(null);
      await loadSales();
      setOk(`Comprobante #${s.id} eliminado. Si correspondía, el stock fue devuelto.`);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function exportExcel() {
    setErr('');
    setOk('');
    try {
      await apiDownload(`/sales/export?${salesQuery}`, `historial_ventas_${dateFrom}_${dateTo}.xlsx`);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  const subtotal = cart.reduce((a, b) => a + b.total, 0);
  const total = Math.max(subtotal - (+discount || 0), 0);

  return (
    <Shell>
      <div className='section-title'>
        <h1>Ventas</h1>
        <div className='tabs'>
          <button className={`tab ${type === 'Presupuesto' ? 'active' : ''}`} onClick={() => setType('Presupuesto')}>
            Presupuesto
          </button>
          <button className={`tab ${type === 'Pedido de venta' ? 'active' : ''}`} onClick={() => setType('Pedido de venta')}>
            Pedido de venta
          </button>
        </div>
      </div>

      {err && <div className='card' style={{ color: 'crimson' }}>{err}</div>}
      {ok && <div className='card' style={{ color: '#7ee787' }}>{ok}</div>}

      <br />

      <div className='pos-layout'>
        <div className='card'>
          <h3>Cargar cliente</h3>
          <div className='form-row'>
            <select className='input' value={customer.contact_id} onChange={(e) => selectContact(e.target.value)}>
              <option value=''>Crear/seleccionar cliente</option>
              {contacts
                .filter((x) => x.type === 'Cliente' || x.type === 'Taller' || x.type === 'Distribuidor')
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.phone}
                  </option>
                ))}
            </select>
            {['customer_name', 'customer_phone', 'customer_document', 'customer_email', 'customer_address', 'seller'].map((k) => (
              <input
                key={k}
                className='input'
                placeholder={k}
                value={customer[k] || ''}
                onChange={(e) => setCustomer({ ...customer, [k]: e.target.value })}
              />
            ))}
          </div>
          <textarea
            className='input'
            placeholder='Observaciones'
            value={customer.notes || ''}
            onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
          />

          <hr />

          <h3>Productos</h3>
          <p className='small'>Escribí al menos 2 letras o números del SKU/descripción. No se cargan todos los productos de entrada.</p>
          <div className='form-row'>
            <input className='input' placeholder='Buscar SKU o descripcion' value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className='input' value={pid} onChange={(e) => setPid(e.target.value)}>
              <option value=''>{loadingProducts ? 'Buscando...' : 'Producto'}</option>
              {products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.sku} {x.name} Stock {x.available_stock} ${x.sale_price}
                </option>
              ))}
            </select>
            <input className='input' type='number' value={q} onChange={(e) => setQ(+e.target.value)} />
            <button className='btn' onClick={() => add()} disabled={!pid}>
              Agregar
            </button>
          </div>
        </div>

        <div className='invoice'>
          <h3>{type}</h3>
          <p className='small'>{type === 'Presupuesto' ? 'No descuenta stock.' : 'Descuenta stock al registrar.'}</p>
          <div className='table-wrap'>
            <table className='table'>
              <tbody>
                {cart.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <b>{c.sku}</b>
                      <div className='small'>{c.name}</div>
                    </td>
                    <td>{c.quantity}</td>
                    <td>${c.unit_price}</td>
                    <td>${c.total}</td>
                    <td>
                      <button className='btn secondary' onClick={() => remove(i)}>
                        x
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <br />
          <div className='form-row'>
            <select className='input' value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta</option>
              <option>Cuenta corriente</option>
            </select>
            <input className='input' type='number' placeholder='Descuento' value={discount} onChange={(e) => setDiscount(+e.target.value)} />
          </div>
          <p>Subtotal: ${subtotal}</p>
          <div className='total-box'>Total ${total}</div>
          <br />
          <button className='btn' style={{ width: '100%' }} disabled={!cart.length} onClick={submit}>
            Registrar {type}
          </button>
        </div>
      </div>

      <br />

      <div className='section-title'>
        <div>
          <h3>Historial de comprobantes</h3>
          <p className='small'>Por defecto muestra solo los últimos 2 días para que cargue rápido.</p>
        </div>
        <button className='btn secondary' onClick={exportExcel}>
          Descargar Excel
        </button>
      </div>

      <div className='card'>
        <div className='form-row'>
          <label className='small'>
            Desde
            <input className='input' type='date' value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className='small'>
            Hasta
            <input className='input' type='date' value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button className='btn' onClick={loadSales}>
            Filtrar
          </button>
        </div>
      </div>

      <div className='table-wrap'>
        <table className='table'>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Medio</th>
              <th>Total</th>
              <th>Costo</th>
              <th>Utilidad</th>
              <th>Margen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td><span className='pill'>{s.type}</span></td>
                <td>{s.customer_name}</td>
                <td>{String(s.created_at).slice(0, 19)}</td>
                <td>{s.payment_method}</td>
                <td>{money(s.total)}</td>
                <td>{s.type === 'Pedido de venta' ? money(s.cost) : '-'}</td>
                <td>{s.type === 'Pedido de venta' ? money(s.profit) : '-'}</td>
                <td>{s.type === 'Pedido de venta' ? pct(s.margin) : '-'}</td>
                <td>
                  <div className='form-row' style={{ gap: 8, flexWrap: 'nowrap' }}>
                    <button className='btn secondary' onClick={() => openSale(s)}>Ver / editar</button>
                    <button className='btn secondary' title='Eliminar comprobante' onClick={() => deleteSale(s)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className='card' style={{ maxWidth: 980, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className='section-title'>
              <h2>Comprobante #{selected.id}</h2>
              <button className='btn secondary' onClick={() => setSelected(null)}>Cerrar</button>
            </div>

            <div className='form-row'>
              <select className='input' value={edit.payment_method} onChange={(e) => setEdit({ ...edit, payment_method: e.target.value })}>
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
                <option>Cuenta corriente</option>
              </select>
              {['customer_name', 'customer_phone', 'customer_document', 'customer_email', 'customer_address', 'seller'].map((k) => (
                <input key={k} className='input' placeholder={k} value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
              ))}
            </div>

            <textarea className='input' placeholder='Observaciones' value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            <br />
            <div className='form-row'>
              <button className='btn' onClick={saveSale}>Guardar cambios</button>
              {selected.type === 'Presupuesto' && (
                <button className='btn secondary' onClick={convertSale}>Convertir presupuesto a venta</button>
              )}
            </div>

            <hr />

            <h3>Detalle</h3>
            <div className='table-wrap'>
              <table className='table'>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Total</th>
                    <th>Costo</th>
                    <th>Utilidad</th>
                    <th>Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items?.map((it: any) => (
                    <tr key={it.id}>
                      <td>{it.sku}</td>
                      <td>{it.name}</td>
                      <td>{it.quantity}</td>
                      <td>{money(it.unit_price)}</td>
                      <td>{money(it.total)}</td>
                      <td>{selected.type === 'Pedido de venta' ? money(it.cost) : '-'}</td>
                      <td>{selected.type === 'Pedido de venta' ? money(it.profit) : '-'}</td>
                      <td>{selected.type === 'Pedido de venta' && it.total ? pct((it.profit / it.total) * 100) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Subtotal: {money(selected.subtotal)} · Descuento: {money(selected.discount)}
              {selected.type === 'Pedido de venta' && (
                <> · Costo: {money(selected.cost)} · Utilidad: {money(selected.profit)} · Margen: {pct(selected.margin)}</>
              )}
            </p>
            <div className='total-box'>Total {money(selected.total)}</div>
          </div>
        </div>
      )}
    </Shell>
  );
}
