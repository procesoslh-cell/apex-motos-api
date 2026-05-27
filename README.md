# APEX-MOTOS MVP V6

ERP web estilo Odoo para casa de repuestos de motos.

## Stack
- Backend: FastAPI, SQLAlchemy, SQLite MVP
- Frontend: Next.js, React, CSS custom

## Usuario inicial
- Usuario: `admin`
- Clave: `admin123`

## Cambios V6
- Nuevo modulo **Productos** con maestro de producto, categorias y subcategorias, edicion, margen, stock minimo, compatibilidades y proveedores asociados.
- Nuevo modulo **Contactos** para clientes, talleres, distribuidores y proveedores.
- Proveedores redisenado como ficha/contacto empresa con razon social, CUIT, condicion fiscal, contacto, direccion, vendedor, coeficiente y observaciones.
- Proveedores ahora permite editar y desactivar/eliminar.
- Inventario con buscador rapido por SKU, descripcion, categoria, proveedor y SKU proveedor.
- Importacion de listas de proveedor con template del cliente:
  - `SKU`: SKU propio
  - `PROVEEDORES`: nombre proveedor informativo
  - `COD`: SKU proveedor
  - `DESCRIPION`: descripcion producto
  - `COSTO`: costo proveedor
  - `COEF`: coeficiente informativo
  - `COS/FINAL`: formula en template
  - `MARGEN`: margen producto
  - `PRECIO VENTA`: formula en template
  - `STOCK`: stock proveedor
- Compras permite importar Excel por proveedor con columnas `SKU`, `CANTIDAD`, `COSTO`.
- Ventas redisenado con dos flujos: **Presupuesto** y **Pedido de venta**.
  - Presupuesto no descuenta stock.
  - Pedido de venta descuenta stock.
  - Carga/crea cliente y lo guarda en Contactos.
- Categorias modelo para repuestos de motos precargadas.
- Templates Excel nuevos en `/docs`:
  - `template_lista_proveedor_cliente.xlsx`
  - `template_compra_proveedor.xlsx`

## Ejecutar backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Ejecutar frontend
```bash
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Nota SQLite
Si venis de una base V5 local, borrar `backend/apex_motos.db` antes de levantar V6 para que SQLAlchemy cree las nuevas tablas/columnas.

## V6.2
- Login rediseñado con estética Nexus.
- Se quitó la ayuda visible `admin / admin123` del login.
- Branding: Desarrollado y Diseñado por Nexo Consultora.
- Nuevo importador maestro de productos desde Productos > Importar productos.
- Template: docs/template_importacion_productos.xlsx.
- La importación crea/actualiza productos y crea categorías/subcategorías si no existen.
