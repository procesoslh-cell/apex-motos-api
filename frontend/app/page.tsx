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

export default function Home(){
  const[d,setD]=useState<any>(null);
  useEffect(()=>{apiGet('/dashboard').then(setD).catch(console.error)},[]);
  const kpis=[
    ['products','Productos activos',d?.products??'-','Maestro de productos'],
    ['low_stock','Productos bajo stock',d?.low_stock??'-','Reponer primero'],
    ['sales_total','Ventas registradas',money(d?.sales_total),'Pedidos de venta'],
    ['stock_value','Valor de stock',money(d?.stock_value),'Costo inventario'],
    ['potential_sale_value','Valor potencial',money(d?.potential_sale_value),'Stock a precio venta'],
    ['quotes','Presupuestos',d?.quotes??'-','Oportunidades abiertas']
  ];
  return <Shell>
    <div className='hero-dashboard'>
      <div>
        <span className='badge'>ERP comercial APEX-MOTOS</span>
        <h1>Dashboard comercial</h1>
        <p className='muted'>Vista rápida para vender mejor: stock crítico, rotación, ventas, compras y accesos directos.</p>
      </div>
      <div className='actions'>
        <Link className='btn' href='/ventas'>Nueva venta</Link>
        <Link className='btn secondary' href='/compras'>Importar compra</Link>
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
          {(d?.top_selling||[]).length===0&&<tr><td colSpan={4} className='muted'>Todavía no hay pedidos de venta registrados.</td></tr>}
          {(d?.top_selling||[]).map((p:any)=><tr key={p.id}>
            <td><b>{p.sku}</b></td><td>{p.name}<div className='small'>Stock actual: {p.stock}</div></td><td>{p.quantity}</td><td>{money(p.amount)}</td>
          </tr>)}
        </tbody></table></div>
      </div>
    </div>

    <div className='dashboard-layout secondary-layout'>
      <div className='card'>
        <div className='section-title'><h2>Ventas recientes</h2><span className='small'>Presupuestos y pedidos</span></div>
        <div className='table-wrap'><table className='table'><thead><tr><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Total</th></tr></thead><tbody>
          {(d?.recent_sales||[]).length===0&&<tr><td colSpan={4} className='muted'>Sin ventas recientes.</td></tr>}
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
