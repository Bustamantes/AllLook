# SASTRERÍA "ALL LOOK" — SISTEMA Y PLATAFORMA DE GESTIÓN OPERATIVA

Plataforma integral diseñada para operar los procesos de negocio de la **Sastrería y Boutique All Look** bajo un flujo estricto de 6 etapas, control de acceso por URL secreta y permisos granulares por trabajador.

---

## Arquitectura Web Multi-Página

### 1. Tienda Pública para Clientes
- **`/`** — Galería enfocada en exhibir las piezas disponibles con filtros por categoría y acceso limpio a solicitudes.
- **`/pieza/{id}`** — Subpágina de desglose completo por pieza (tejido, talla, color, estilo, tiempos de entrega, cuidados y formulario directo para solicitar la pieza).
- **`/solicitar`** — Subpágina de atención con 3 subpestañas:
  1. *Otro Producto / A la Medida*
  2. *Arreglo de Prenda*
  3. *Cómo Funciona y Reglas*

### 2. Portal Privado del Taller (URL Secreta + Login Obligatorio)
Accesible únicamente mediante la ruta secreta configurada en `STAFF_SECRET_PATH` (ejemplo por defecto: `/atelier-privado-9x4k2m`). Las rutas `/admin`, `/empleados`, `/taller` y `/docs` permanecen deshabilitadas (`404`).

#### Flujo de Trabajo y Roles
1. **Mostrador / Caja:** Toma el pedido inicial (o confirma solicitudes web) con anticipo del 50%, fecha de entrega y cita de control 15 días antes.
2. **Sastre Patronista:** Registra las medidas exactas en la orden generada por mostrador, solicita las telas necesarias al Analista de Inventario y envía la pieza terminada a Control de Calidad.
3. **Analista de Inventario:** Recibe y despacha las solicitudes de telas del Sastre Patronista y gestiona órdenes a proveedores bajo la regla del 30%.
4. **Control de Calidad:** Valida las piezas terminadas y aprueba su retorno a mostrador (o las devuelve al Sastre Patronista si requieren corrección).
5. **Notificación y Ajustes:** Mostrador contacta al cliente para entrega o prueba final; si requiere un arreglo menor, reenvía el ticket al Sastre Patronista sin costo adicional.
6. **Facturación:** Mostrador cobra el saldo pendiente obligatorio y emite el comprobante oficial antes de liberar la pieza.

#### Administración Total
El **Administrador General** cuenta con control completo sobre cuentas de trabajadores (crear, activar/suspender, cambiar contraseña, asignar o revocar vistas exactas en tiempo real y previsualizar la interfaz de cualquier trabajador).

---

## Reglas del Negocio Conservadas
1. **Anticipo Obligatorio del 50%** antes de enviar confección a la medida al Sastre Patronista.
2. **Cita de verificación 15 días antes** de la entrega y aceptación de cláusula de variación de medidas.
3. **Control de Calidad previo obligatorio** antes de pasar a mostrador para entrega.
4. **Arreglo menor post-prueba sin costo adicional** si la prenda no calza tras contactar al cliente.
5. **Liquidación total del saldo pendiente** obligatoria antes de emitir la factura final y entregar.
6. **Punto de reorden al 30%** para compras de telas e insumos a proveedores.

---

## Variables de Entorno para Despliegue (Docker / Coolify)

```env
PORT=8090
STAFF_SECRET_PATH=atelier-privado-9x4k2m
ADMIN_PASSWORD=tu-clave-admin-segura
STAFF_DEFAULT_PASSWORD=tu-clave-trabajadores
SESSION_SECRET=clave-hmac-aleatoria-larga
ENABLE_DOCS=false
```

### Levantar localmente
```bash
docker compose up --build -d
```
