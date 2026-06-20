'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import Shell from '../components/Shell';
import {apiGet} from '../lib/api';

const modules=[
  ['🧩','Productos','Maestro, categorías y costos','/productos'],
  ['📦','Inventario','Stock, reservas y alertas','/inventario'],
  ['🏭','Proveedores','CRM proveedor y coeficientes','/proveedores'],
  ['🧾','Compras','Ingreso e importación por Excel','/compras'],
  ['🛒','Ventas','Presupuesto y pedido de venta','/ventas'],
  ['🤝','Contactos','Clientes y CRM básico','/contactos'],
  ['👥','Usuarios','Roles Admin/Sucursal','/usuarios']
];

function money(v:number){return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v||0)}
function date(v:string){return v?new Date(v).toLocaleDateString('es-AR'):'-'}
function iso(d:Date){return d.toISOString().slice(0,10)}
function monthRange(offset=0){const now=new Date();const first=new Date(now.getFullYear(),now.getMonth()+offset,1);const last=new Date(now.getFullYear(),now.getMonth()+offset+1,0);return {start:iso(first),end:iso(last)}}
function todayRange(){const now=new Date();return {start:iso(now),end:iso(now)}}

export default function Home(){
  const[d,setD]=useState<any>(null);
  const[loading,setLoading]=useState(false);
  const initial=monthRange(0);
  const[startDate,setStartDate]=useState(initial.start);
  const[endDate,setEndDate]=useState(initial.end);

  async function load(s=startDate,e=endDate){
    setLoading(true);
    try{
      const qs=new URLSearchParams();
      if(s) qs.set('start_date',s);
      if(e) qs.set('end_date',e);
      setD(await apiGet(`/dashboard?${qs.toString()}`));
    }catch(err){console.error(err)}
    finally{setLoading(false)}
  }
  useEffect(()=>{load(initial.start,initial.end)},[]);

  function applyRange(r:{start:string,end:string}){setStartDate(r.start);setEndDate(r.end);load(r.start,r.end)}
  const kpis=[
    ['products','Productos activos',d?.products??'-','Maestro de productos'],
    ['low_stock','Productos bajo stock',d?.low_stock??'-','Reponer primero'],
    ['sales_total','Ventas del período',money(d?.sales_total),'Pedidos de venta'],
    ['sold_cost','Costo mercadería vendida',money(d?.sold_cost),'Costo de productos vendidos'],
    ['gross_profit','Utilidad bruta',money(d?.gross_profit),'Venta menos costo'],
    ['gross_margin','Margen bruto %',`${Number(d?.gross_margin||0).toFixed(1)}%`,'Utilidad / ventas'],
    ['stock_value','Valor de stock',money(d?.stock_value),'Costo inventario'],
    ['potential_sale_value','Valor potencial',money(d?.potential_sale_value),'Stock a precio venta'],
    ['quotes','Presupuestos',d?.quotes??'-','Oportunidades abiertas']
  ];
  return <Shell>
    <div className='hero-dashboard'>
      <div>
        <span className='badge'>ERP comercial APEX-MOTOS</span>
        <h1>Dashboard comercial</h1>
        <p className='muted'>Vista rápida para vender mejor: stock crítico, rotación, ventas, utilidad y accesos directos.</p>
      </div>
      <div className='actions'>
        <Link className='btn' href='/ventas'>Nueva venta</Link>
        <Link className='btn secondary' href='/compras'>Importar compra</Link>
      </div>
    </div>

    <div className='card' style={{marginBottom:18}}>
      <div className='section-title'>
        <h2>Período del dashboard</h2>
        <span className='small'>{loading?'Actualizando...':'Indicadores calculados según fecha de venta'}</span>
      </div>
      <div className='form-row'>
        <label><span className='small'>Desde</span><input className='input' type='date' value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
        <label><span className='small'>Hasta</span><input className='input' type='date' value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
        <button className='btn' onClick={()=>load()}>Aplicar filtro</button>
        <button className='btn secondary' onClick={()=>applyRange(todayRange())}>Hoy</button>
        <button className='btn secondary' onClick={()=>applyRange(monthRange(0))}>Este mes</button>
        <button className='btn secondary' onClick={()=>applyRange(monthRange(-1))}>Mes anterior</button>
      </div>
    </div>

    <div className='grid dashboard-kpis'>
      {kpis.map(([k,l,v,desc]:any)=><div className='card kpi big' key={k}>
        <span className='small'>{l}</span>
        <h2>{v}</h2>
        <p className='small'>{desc}</p>
      </div>)}
    </div>

    <div className='dashboard-layout'>
      <div className='card'>
        <div className='section-title'><h2>Productos con bajo stock</h2><Link href='/inventario' className='small'>Ver inventario →</Link></div>
        <div className='table-wrap'><table className='table'><thead><tr><th>SKU</th><th>Producto</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody>
          {(d?.low_stock_products||[]).length===0&&<tr><td colSpan={5} className='muted'>Sin alertas de stock bajo.</td></tr>}
          {(d?.low_stock_products||[]).map((p:any)=><tr key={p.id}>
            <td><b>{p.sku}</b></td><td>{p.name}</td><td>{p.stock}</td><td>{p.min_stock}</td><td><span className='pill bad'>Reponer</span></td>
          </tr>)}
        </tbody></table></div>
      </div>

      <div className='card'>
        <div className='section-title'><h2>Más vendidos / rotación</h2><Link href='/ventas' className='small'>Ver ventas →</Link></div>
        <div className='table-wrap'><table className='table'><thead><tr><th>SKU</th><th>Producto</th><th>Unid.</th><th>Total</th></tr></thead><tbody>
          {(d?.top_selling||[]).length===0&&<tr><td colSpan={4} className='muted'>Todavía no hay pedidos de venta registrados en este período.</td></tr>}
          {(d?.top_selling||[]).map((p:any)=><tr key={p.id}>
            <td><b>{p.sku}</b></td><td>{p.name}<div className='small'>Stock actual: {p.stock}</div></td><td>{p.quantity}</td><td>{money(p.amount)}</td>
          </tr>)}
        </tbody></table></div>
      </div>
    </div>

    <div className='dashboard-layout secondary-layout'>
      <div className='card'>
        <div className='section-title'><h2>Ventas del período</h2><span className='small'>Presupuestos y pedidos filtrados</span></div>
        <div className='table-wrap'><table className='table'><thead><tr><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Total</th></tr></thead><tbody>
          {(d?.recent_sales||[]).length===0&&<tr><td colSpan={4} className='muted'>Sin ventas en este período.</td></tr>}
          {(d?.recent_sales||[]).map((s:any)=><tr key={s.id}><td>{date(s.created_at)}</td><td><span className={s.type==='Presupuesto'?'pill warn':'pill ok'}>{s.type}</span></td><td>{s.customer_name||'Consumidor final'}</td><td>{money(s.total)}</td></tr>)}
        </tbody></table></div>
      </div>

      <div className='card'>
        <div className='section-title'><h2>Compras recientes</h2><span className='small'>Ingreso de stock</span></div>
        <div className='table-wrap'><table className='table'><thead><tr><th>Fecha</th><th>Proveedor</th><th>Producto</th><th>Total</th></tr></thead><tbody>
          {(d?.recent_purchases||[]).length===0&&<tr><td colSpan={4} className='muted'>Sin compras recientes.</td></tr>}
          {(d?.recent_purchases||[]).map((p:any)=><tr key={p.id}><td>{date(p.created_at)}</td><td>{p.supplier_name}</td><td><b>{p.sku}</b><div className='small'>{p.product_name} · Cant. {p.quantity}</div></td><td>{money(p.total)}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>

    <h2 style={{marginTop:24}}>Módulos</h2>
    <div className='module-grid'>{modules.map(([i,t,desc,h])=><Link href={h} className='module' key={h}><div className='icon'>{i}</div><b>{t}</b><p className='small'>{desc}</p></Link>)}</div>
  </Shell>
}