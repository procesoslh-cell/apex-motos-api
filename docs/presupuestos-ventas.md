# Presupuestos pendientes y ventas

## Objetivo
Separar el presupuesto de la venta real.

- El presupuesto NO descuenta stock.
- El presupuesto puede editarse.
- El descuento queda explícito por línea.
- La venta se confirma recién con el botón **Convertir venta**.
- Al convertir, se valida stock y se descuenta del stock local.

## Mejoras incluidas

### Productos rápidos
Endpoint incremental:

```txt
GET /api/products/search?q=texto
```

Reglas:
- mínimo 3 caracteres
- debounce en frontend
- máximo 20 resultados

### Presupuestos
Endpoints:

```txt
GET    /api/sales/budgets
GET    /api/sales/budgets/:id
POST   /api/sales/budgets
PATCH  /api/sales/budgets/:id
PATCH  /api/sales/budgets/:id/convert
PATCH  /api/sales/budgets/:id/cancel
```

### Auditoría
Tabla:

```txt
sales_audit_log
```

Registra:
- creación
- edición
- cancelación
- conversión a venta

### Alertas
Endpoint:

```txt
POST /api/notifications/check-sales-alerts
```

Genera alerta interna y email si un presupuesto queda pendiente más de 48 horas.

## Próxima mejora recomendada
Conectar productos/stock/precios reales contra Odoo o NetSuite. Hoy el módulo queda preparado con estructura compatible.
