# SASTRERÍA "ALL LOOK" — SISTEMA Y PLATAFORMA DE GESTIÓN OPERATIVA

Plataforma integral desarrollada para registrar, automatizar y operar los procesos clave de negocio de la **Sastrería y Boutique All Look**: confección artesanal a la medida, venta y exhibición de prendas exclusivas, arreglos express, alquiler para eventos especiales, control estricto de calidad y abastecimiento con punto de reorden al 30%.

---

## 📌 Descripción del Sistema de Negocio

El presente software formaliza, sistematiza y documenta los procesos operativos de la **Sastrería All Look**, empresa dedicada a la venta al detal de prendas confeccionadas, elaboración y confección de prendas a la medida, arreglos/modificaciones y alquiler de trajes/vestidos para eventos especiales.

El sistema digitaliza el flujo operativo de la sastrería, implementando reglas de validación en tiempo real, trazabilidad de piezas, control de inventario de insumos, gestión de clientes y emisión de comprobantes oficiales de pago.

---

## ⚙️ Reglas del Negocio Implementadas

1. **Anticipo Obligatorio del 50%:** Toda prenda a la medida exige un anticipo mínimo del 50% antes de habilitar el corte y costura en el taller para proteger los costos de tela y mano de obra.
2. **Cita de Verificación a 15 Días Antes de la Entrega:** Se calcula y agenda automáticamente una cita de comprobación 15 días antes de la fecha final para confirmar que las medidas anatómicas no hayan variado. El taller no asume responsabilidad por fluctuaciones de peso, salvo causa médica.
3. **Control de Calidad Previo Obligatorio:** Ninguna prenda puede liberarse al mostrador ni entregarse sin haber sido revisada y aprobada por el área de Control de Calidad (costuras uniformes, ausencia de hilos sueltos, medidas conformes).
4. **Garantía de Calce Sin Costo Adicional:** Si en la prueba final en el probador la prenda no calza adecuadamente, el ajuste correctivo reingresa al taller sin costo alguno para el cliente.
5. **Liquidación Obligatoria Antes de la Entrega:** El pago del saldo restante es estrictamente obligatorio antes de liberar la prenda terminada en su funda protectora.
6. **Punto de Reorden de Insumos al 30%:** El reabastecimiento de telas, hilos, botones y cremalleras con proveedores externos se activa cuando las existencias caen al 30% o menos del nivel óptimo.
7. **Contratos de Alquiler y Depósito de Garantía:** El alquiler de trajes de etiqueta y vestidos incluye registro de evento, devolución pactada, depósito de garantía reembolsable y proceso de inspección por posibles daños o manchas antes de reintegrar la prenda al inventario.

---

## 🚀 Cómo Ejecutar la Aplicación con Docker

### Requisitos Previos:
- Docker y Docker Compose instalados en el sistema.

### 1. Construir y Levantar el Contenedor
Desde la raíz del proyecto (`/home/edwin/Documentos/Proyectos/AllLook`):

```bash
docker compose up --build -d
```

### 2. Acceder a las Plataformas Web
Una vez iniciado el contenedor, acceda desde el navegador:
- **Portal de Clientes:** [http://localhost:8080/](http://localhost:8080/)
- **Portal del Taller & Personal:** [http://localhost:8080/taller](http://localhost:8080/taller)
- **Documentación Interactiva de APIs (Swagger/OpenAPI):** [http://localhost:8080/docs](http://localhost:8080/docs)

### 3. Comandos Útiles
- **Ver logs en tiempo real:**
  ```bash
  docker compose logs -f
  ```
- **Detener el servicio:**
  ```bash
  docker compose down
  ```
- **Reiniciar el servicio:**
  ```bash
  docker compose restart
  ```

---

## 📁 Estructura del Proyecto

```
AllLook/
├── Dockerfile                  # Imagen Docker optimizada (Python 3.11-slim)
├── docker-compose.yml          # Configuración de Docker Compose y puertos (8080)
├── requirements.txt            # Dependencias del backend (FastAPI, Uvicorn, Pydantic)
├── .dockerignore               # Archivos excluidos de la compilación
├── README.md                   # Documentación técnica del proyecto All Look
├── app/
│   ├── __init__.py
│   ├── main.py                 # Endpoints RESTful y lógica de negocio
│   ├── database.py             # Configuración SQLite y DDL de tablas
│   ├── schemas.py              # Esquemas de validación Pydantic
│   └── seed_data.py            # Semilla con catálogo, inventario y órdenes
├── data/                       # Volumen persistente para la base de datos SQLite
└── static/
    ├── index.html              # Portal Web para Clientes
    ├── taller.html             # Portal Intranet para Personal del Taller
    ├── css/
    │   └── styles.css          # Paleta de colores, tarjetas y estilos de impresión
    └── js/
        ├── auth.js             # Autenticación normal de clientes
        ├── staff_auth.js       # Autenticación y roles del taller
        ├── cliente.js          # Lógica interactiva del portal de clientes
        └── app.js              # Tablero y operaciones internas del taller
```
