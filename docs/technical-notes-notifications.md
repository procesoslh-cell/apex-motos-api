# Notificaciones y alertas CRM

## Qué se agregó

- El supervisor puede asignar leads desde Radiografía Comercial.
- Al asignar un lead se crea una notificación interna para el vendedor.
- Al asignar un lead también se intenta enviar email al vendedor asignado.
- Al ingresar a la plataforma se ejecuta el control de alertas CRM:
  - acciones CRM vencidas
  - acciones CRM por vencer
- Las alertas se guardan en `notifications` y en `crm_alerts`.

## Endpoints relevantes

- `POST /api/comercial/clientes/:clienteId/asignar-lead`
- `POST /api/notifications/check-crm-alerts`
- `GET /api/email/status`
- `POST /api/test-email`

## Motivos por los que puede no salir email

1. Faltan variables SMTP:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`

2. El usuario asignado no tiene email cargado en la tabla `users`.

3. Office365 bloquea SMTP AUTH para la cuenta.

4. La contraseña SMTP no es válida o requiere app password.

5. Firewall/red bloquea salida hacia SMTP.

6. `APP_URL` no está configurado y los links apuntan al localhost.

## Cómo verificar

Abrir:

```text
http://localhost:3001/api/email/status
```

Enviar prueba:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/test-email" -Method POST -ContentType "application/json" -Body '{"to":"tuemail@dominio.com"}'
```
