# SGI Lopez - Arquitectura modular

Este backend fue reorganizado para separar el MVP en dominios mantenibles.

## Estructura

```txt
backend/
  server.js              # Arranque HTTP
  src/
    app.js               # Configura Express y registra modulos
    core/context.js      # Dependencias compartidas temporales del MVP
    db/
      index.js           # Conexion SQLite actual
      schema.js          # Inicializacion de tablas y migraciones simples
    modules/
      auth/
      users/
      requests/
      collections/
      crm/
      odoo/
      dashboard/
      trips/
      notifications/
      email/
```

## Estado actual

La modularizacion mantiene la funcionalidad existente y deja el proyecto listo para crecer por dominio.
El siguiente paso recomendado es separar servicios y repositorios por modulo:

```txt
modules/crm/
  crm.routes.js
  crm.service.js
  crm.repository.js
```

## Roadmap tecnico recomendado

1. Migrar SQLite a PostgreSQL.
2. Agregar migraciones formales con Prisma, Knex o Sequelize.
3. Reemplazar passwords en texto plano por bcrypt.
4. Agregar JWT/sesiones y permisos por rol.
5. Separar capa ERP: `erp.service.js`, `odoo.adapter.js`, `netsuite.adapter.js`.
6. Agregar logging estructurado y monitoreo.
7. Crear ambientes dev/test/prod.
8. Documentar API con OpenAPI/Swagger.

## Capa ERP futura

El CRM debe operar como capa independiente del ERP. Odoo o NetSuite deben actuar como adapters:

```txt
CRM Frontend -> CRM Backend -> ERP Service -> Odoo Adapter / NetSuite Adapter
```

Esto permite reemplazar el ERP sin reescribir la logica comercial.
