'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '../../components/Shell';
import { apiDownload, apiGet, apiPost, apiUpload } from '../../lib/api';

const PAGE_SIZE = 50;

export default function Productos() {
  const [p, setP] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [serverQ, setServerQ] = useState('');
  const [cat, setCat] = useState('');
  const [sub, setSub] = useState('');
  const [catId, setCatId] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [adj, setAdj] = useState<any>({ percent: 5, category: 'Todas', subcategory: 'Todas', base: 'sale_price' });
  const [adjMsg, setAdjMsg] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [kit, setKit] = useState<any>({ sku: '', name: '', sale_price: 0, category: 'Kits', subcategory: 'General', brand: '', description: '' });
  const [kitSearch, setKitSearch] = useState('');
  const [kitOptions, setKitOptions] = useState<any[]>([]);
  const [kitSelected, setKitSelected] = useState('');
  const [kitQty, setKitQty] = useState(1);
  const [kitComponents, setKitComponents] = useState<any[]>([]);
  const [kitMsg, setKitMsg] = useState('');

  const productEndpoint = (nextLimit = limit, search = serverQ) => {
    const params = new URLSearchParams();
    params.set('limit', String(nextLimit));
    params.set('offset', '0');
    if (search.trim()) params.set('q', search.trim());
    return `/products/paged?${params.toString()}`;
  };

  const loadProducts = async (nextLimit = limit, search = serverQ) => {
    setLoading(true);
    try {
      const r = await apiGet(productEndpoint(nextLimit, search));
      setP(r.items || []);
      setTotal(r.total || 0);
      setLimit(r.limit || nextLimit);
    } finally {
      setLoading(false);
    }
  };

  const load = async () => {
    const [products, categories] = await Promise.all([
      apiGet('/products/paged?limit=50&offset=0'),
      apiGet('/categories'),
    ]);
    setP(products.items || []);
    setTotal(products.total || 0);
    setLimit(products.limit || PAGE_SIZE);
    setCats(categories);
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => p.filter(x => `${x.sku} ${x.name} ${x.category} ${x.subcategory} ${x.brand} ${x.suppliers?.map((s: any) => s.supplier_name + ' ' + s.supplier_sku).join(' ')}`.toLowerCase().includes(q.toLowerCase())), [p, q]);
  const selectedCat = cats.find((c: any) => c.name === adj.category);
  const shown = Math.min(rows.length, total || rows.length);
  const canLoadMore = p.length < total && !q.trim();

  async function addCat(e: any) {
    e.preventDefault();
    if (cat) await apiPost('/categories', { name: cat });
    setCat('');
    load();
  }

  async function addSub(e: any) {
    e.preventDefault();
    if (sub && catId) await apiPost('/subcategories', { category_id: +catId, name: sub });
    setSub('');
    load();
  }

  async function importProducts(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg('Importando productos...');
    try {
      const r = await apiUpload('/products/import', file);
      setImportMsg(`${r.created} creados · ${r.updated} actualizados · ${r.skipped} omitidos. El importador reconoce columnas por nombre: SKU, DESCRIPCION, PRECIO VENTA, COSTO, STOCK, CATEGORIA, SUBCATEGORIA, etc.`);
      loadProducts(limit, serverQ);
    } catch (err: any) {
      setImportMsg('Error al importar: ' + (err?.message || 'verificar columnas'));
    } finally {
      e.target.value = '';
    }
  }

  async function applyAdjust(e: any) {
    e.preventDefault();
    setAdjMsg('Aplicando actualización...');
    try {
      const body = { ...adj, percent: +adj.percent, category: adj.category === 'Todas' ? '' : adj.category, subcategory: adj.subcategory === 'Todas' ? '' : adj.subcategory };
      const r = await apiPost('/products/adjust-prices', body);
      setAdjMsg(`${r.updated} productos actualizados con ${r.percent}%`);
      loadProducts(limit, serverQ);
    } catch (err: any) {
      setAdjMsg('Error: ' + (err?.message || 'no se pudo aplicar'));
    }
  }

  async function searchProducts(e: any) {
    e.preventDefault();
    setServerQ(q.trim());
    await loadProducts(PAGE_SIZE, q.trim());
  }

  async function clearSearch() {
    setQ('');
    setServerQ('');
    await loadProducts(PAGE_SIZE, '');
  }

  async function more() {
    const next = Math.min(limit + PAGE_SIZE, total || limit + PAGE_SIZE);
    await loadProducts(next, serverQ);
  }

  async function downloadMaster() {
    setDownloading(true);
    try {
      await apiDownload('/products/export', 'maestro_productos_apex.xlsx');
    } finally {
      setDownloading(false);
    }
  }


  async function searchKitComponents() {
    const term = kitSearch.trim();
    if (term.length < 2) {
      setKitOptions([]);
      return;
    }
    const r = await apiGet(`/products/search?q=${encodeURIComponent(term)}&limit=30`);
    setKitOptions(r || []);
  }

  function addKitComponent() {
    const product = kitOptions.find((x: any) => String(x.id) === String(kitSelected));
    if (!product) return;
    if (kitComponents.some((x: any) => x.component_product_id === product.id)) {
      setKitMsg('Ese componente ya está agregado al kit.');
      return;
    }
    setKitComponents([...kitComponents, { component_product_id: product.id, quantity: Number(kitQty) || 1, sku: product.sku, name: product.name, stock: product.available_stock ?? product.stock }]);
    setKitSelected('');
    setKitQty(1);
    setKitMsg('');
  }

  async function createKit(e: any) {
    e.preventDefault();
    if (!kit.sku || !kit.name || !kit.sale_price || kitComponents.length === 0) {
      setKitMsg('Completá SKU, nombre, precio y al menos un componente.');
      return;
    }
    setKitMsg('Creando kit...');
    try {
      const created = await apiPost('/products', { ...kit, stock: 0, reserved_stock: 0, min_stock: 0, cost: 0, margin: 0, sale_price: Number(kit.sale_price), active: 1 });
      await apiPost(`/products/${created.id}/kit`, { components: kitComponents.map((x: any) => ({ component_product_id: x.component_product_id, quantity: Number(x.quantity) || 1 })) });
      setKit({ sku: '', name: '', sale_price: 0, category: 'Kits', subcategory: 'General', brand: '', description: '' });
      setKitComponents([]);
      setKitSearch('');
      setKitOptions([]);
      setKitMsg('Kit creado correctamente. En ventas aparece como producto normal y descuenta sus componentes.');
      loadProducts(limit, serverQ);
    } catch (err: any) {
      setKitMsg('Error al crear kit: ' + (err?.message || 'verificar datos'));
    }
  }

  return <Shell><div className='section-title'><h1>Productos</h1><div className='actions'><button className='btn' onClick={() => location.href = '/productos/nuevo'}>Nuevo producto</button><button className='btn secondary' onClick={downloadMaster} disabled={downloading}>{downloading ? 'Descargando...' : 'Descargar maestro completo'}</button><label className='btn secondary' style={{ cursor: 'pointer' }}>Importar / actualizar Excel<input type='file' accept='.xlsx,.xls' onChange={importProducts} style={{ display: 'none' }} /></label></div></div><div className='card' style={{ marginBottom: 14 }}><form onSubmit={searchProducts} className='form-row'><input className='input' placeholder='Buscar por SKU, descripción, proveedor, categoría o SKU proveedor...' value={q} onChange={e => setQ(e.target.value)} /><button className='btn'>Buscar</button>{serverQ && <button type='button' className='btn secondary' onClick={clearSearch}>Limpiar</button>}</form><p className='small' style={{ marginTop: 8 }}>{loading ? 'Cargando productos...' : `Mostrando ${shown}/${total || shown} productos${serverQ ? ` para "${serverQ}"` : ''}.`}</p>{canLoadMore && <button className='btn secondary' onClick={more} disabled={loading}>Cargar 50 más</button>}</div>{importMsg && <div className='card' style={{ marginBottom: 14 }}><b>Importación:</b> <span className='small'>{importMsg}</span><p className='small'>Ahora podés subir archivos parciales. Ejemplo: solo SKU + PRECIO VENTA para actualizar precios; SKU + STOCK para stock; SKU + CATEGORIA + SUBCATEGORIA para clasificar.</p></div>}<div className='card' style={{ marginBottom: 16 }}><h3>Crear producto kit</h3><p className='small'>Ejemplo: kit transmisión. El kit no tiene stock propio; al venderlo descuenta los componentes y usa el precio del kit.</p><form onSubmit={createKit}><div className='form-row'><input className='input' placeholder='SKU del kit' value={kit.sku} onChange={e => setKit({ ...kit, sku: e.target.value })} /><input className='input' placeholder='Nombre del kit' value={kit.name} onChange={e => setKit({ ...kit, name: e.target.value })} /><input className='input' type='number' placeholder='Precio venta kit' value={kit.sale_price} onChange={e => setKit({ ...kit, sale_price: e.target.value })} /></div><div className='form-row'><input className='input' placeholder='Categoría' value={kit.category} onChange={e => setKit({ ...kit, category: e.target.value })} /><input className='input' placeholder='Subcategoría' value={kit.subcategory} onChange={e => setKit({ ...kit, subcategory: e.target.value })} /><input className='input' placeholder='Marca / compatibilidad' value={kit.brand} onChange={e => setKit({ ...kit, brand: e.target.value })} /></div><textarea className='input' placeholder='Descripción del kit' value={kit.description} onChange={e => setKit({ ...kit, description: e.target.value })} /></form><div className='form-row' style={{ marginTop: 10 }}><input className='input' placeholder='Buscar componente por SKU o descripción' value={kitSearch} onChange={e => setKitSearch(e.target.value)} /><button type='button' className='btn secondary' onClick={searchKitComponents}>Buscar</button><select className='input' value={kitSelected} onChange={e => setKitSelected(e.target.value)}><option value=''>Componente</option>{kitOptions.map((x: any) => <option key={x.id} value={x.id}>{x.sku} - {x.name} · Stock {x.available_stock ?? x.stock}</option>)}</select><input className='input' type='number' min='1' step='1' placeholder='Cantidad' value={kitQty} onChange={e => setKitQty(Number(e.target.value))} /><button type='button' className='btn secondary' onClick={addKitComponent}>Agregar componente</button></div>{kitComponents.length > 0 && <div className='table-wrap' style={{ marginTop: 10 }}><table className='table'><thead><tr><th>SKU</th><th>Componente</th><th>Cant.</th><th>Stock</th><th></th></tr></thead><tbody>{kitComponents.map((x: any, idx: number) => <tr key={x.component_product_id}><td>{x.sku}</td><td>{x.name}</td><td>{x.quantity}</td><td>{x.stock}</td><td><button type='button' className='btn secondary' onClick={() => setKitComponents(kitComponents.filter((_: any, i: number) => i !== idx))}>Quitar</button></td></tr>)}</tbody></table></div>}<div style={{ marginTop: 10 }}><button type='button' className='btn' onClick={createKit}>Guardar kit</button></div>{kitMsg && <p className='small'>{kitMsg}</p>}</div><div className='grid' style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}><div className='card'><h3>Actualización masiva de precios</h3><p className='small'>Aumentá o bajá precios por porcentaje en toda la lista, por categoría o por subcategoría.</p><form onSubmit={applyAdjust}><div className='form-row'><input type='number' step='0.01' className='input' placeholder='% aumento' value={adj.percent} onChange={e => setAdj({ ...adj, percent: e.target.value })} /><select className='input' value={adj.base} onChange={e => setAdj({ ...adj, base: e.target.value })}><option value='sale_price'>Sobre precio venta actual</option><option value='cost'>Sobre costo</option></select></div><div className='form-row'><select className='input' value={adj.category} onChange={e => setAdj({ ...adj, category: e.target.value, subcategory: 'Todas' })}><option>Todas</option>{cats.map((c: any) => <option key={c.id}>{c.name}</option>)}</select><select className='input' value={adj.subcategory} onChange={e => setAdj({ ...adj, subcategory: e.target.value })}><option>Todas</option>{selectedCat?.subcategories?.map((s: any) => <option key={s.id}>{s.name}</option>)}</select></div><button className='btn'>Aplicar porcentaje</button></form>{adjMsg && <p className='small'>{adjMsg}</p>}</div><div className='card'><h3>Categorías y subcategorías</h3><p className='small'>Se crean acá y después aparecen como desplegables al editar o crear productos.</p><form onSubmit={addCat} className='form-row'><input className='input' placeholder='Nueva categoría' value={cat} onChange={e => setCat(e.target.value)} /><button className='btn'>Crear categoría</button></form><form onSubmit={addSub} className='form-row'><select className='input' value={catId} onChange={e => setCatId(e.target.value)}><option value=''>Elegir categoría</option>{cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className='input' placeholder='Nueva subcategoría' value={sub} onChange={e => setSub(e.target.value)} /><button className='btn'>Crear subcategoría</button></form></div></div><div className='table-wrap'><table className='table'><thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Costo</th><th>Venta</th><th>Proveedor</th><th></th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td><b>{x.sku}</b></td><td>{x.name} {x.is_kit && <span className='pill'>KIT</span>}<div className='small'>{x.brand} {x.compatibility}</div></td><td>{x.category}<div className='small'>{x.subcategory}</div></td><td>{x.available_stock} disp.<div className='small'>{x.is_kit ? 'Stock calculado por componentes' : `${x.stock} real / ${x.reserved_stock} reservado`}</div></td><td>${Math.round(x.cost || 0)}</td><td>${Math.round(x.sale_price || 0)}</td><td>{x.best_supplier ? `${x.best_supplier.supplier_name} · ${x.best_supplier.supplier_sku}` : '-'}</td><td><button className='btn secondary' onClick={() => location.href = `/productos/${x.id}`}>Ver / editar</button></td></tr>)}</tbody></table></div>{canLoadMore && <div style={{ marginTop: 14 }}><button className='btn secondary' onClick={more} disabled={loading}>Cargar 50 más</button></div>}</Shell>;
}
