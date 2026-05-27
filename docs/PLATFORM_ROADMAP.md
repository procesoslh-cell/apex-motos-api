# SGI Platform - Roadmap de crecimiento

## Enfoque

La aplicación evoluciona hacia una plataforma modular por dominios, no una única pantalla monolítica.

```text
SGI Platform
├── CRM Comercial
├── Campañas y asignación
├── Omnicanalidad / Centro de contacto
├── Cobranzas
├── Giras comerciales
├── Integración ERP
├── Notificaciones
└── Analytics
```

## Decisión arquitectónica

El CRM no reemplaza al ERP. El ERP sigue siendo fuente de verdad para stock, precios, facturación y contabilidad. SGI opera como capa de gestión comercial, trazabilidad, workflow y coordinación entre áreas.

## Mejoras incluidas en esta versión

- Módulo de campañas comerciales para clientes inactivos/recompra.
- Generación automática de leads CRM desde campañas.
- Hub omnicanal base para simular leads desde WhatsApp/Web/Ecommerce.
- Endpoint público `/api/public/leads` preparado para formularios y webhooks.
- Alertas CRM automáticas por SLA vencido, por vencer y oportunidades sin actividad.
- Estructura backend modular con rutas separadas para campañas y omnicanalidad.
- Botón de nueva cobranza para recuperar la creación operativa desde vendedor.

## Próximos pasos técnicos

1. Migrar SQLite a PostgreSQL.
2. Implementar migraciones versionadas.
3. Auth con JWT y passwords bcrypt.
4. Separar servicios ERP: `OdooService`, `NetSuiteService`.
5. Conectar WhatsApp real mediante proveedor/API.
6. Agregar colas/eventos para omnicanalidad de alto volumen.
7. Agregar monitoreo, logs y auditoría.

## Integración ERP futura

El CRM debe llamar siempre a una interfaz genérica:

```text
ERPService.validateQuote()
ERPService.createQuote()
ERPService.getStock()
ERPService.getCustomerBalance()
```

Luego se implementa por proveedor:

```text
OdooService
NetSuiteService
```

Esto permite cambiar ERP sin reescribir CRM.
