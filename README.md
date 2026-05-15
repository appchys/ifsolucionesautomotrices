# I.F. Soluciones Automotrices — PWA

Sistema de gestión de taller mecánico. Construido con Next.js 15, Tailwind CSS v4 y Firebase.

## 🚀 Primer Inicio

### 1. Crear el usuario administrador

Ve a: **http://localhost:3000/setup**

Rellena el formulario con las credenciales del administrador y haz clic en **"Crear Administrador"**.

> ⚠️ Esta página solo debe usarse UNA vez. Después de crear el admin, no vuelvas a usarla.

### 2. Ingresar al sistema

Ve a: **http://localhost:3000/login**

Usa las credenciales que acabas de crear.

---

## 🔧 Desarrollo Local

```bash
cd if-soluciones
npm run dev
```

La app estará disponible en: **http://localhost:3000**

---

## 👥 Roles de Usuario

| Rol | Acceso |
|---|---|
| `admin` | Todo el sistema |
| `recepcion` | Recepción, órdenes, clientes, vehículos |
| `tecnico` | Órdenes de trabajo (vista y edición) |
| `contador` | Órdenes, clientes, cobros y pagos |

Para crear más usuarios ve a **Configuración → Gestión de Usuarios** (próximamente en la UI, por ahora hazlo desde `/setup`).

---

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── login/           # Página de login
│   ├── setup/           # Setup inicial (1 sola vez)
│   ├── dashboard/       # Dashboard principal
│   ├── recepcion/       # Módulo de recepción (wizard 4 pasos)
│   ├── ordenes/         # Lista + detalle de órdenes
│   │   └── [id]/        # Detalle con items, fotos, informe
│   ├── clientes/        # CRUD de clientes
│   ├── vehiculos/       # CRUD de vehículos
│   ├── pagos/           # Módulo de cobros y abonos
│   ├── progreso/        # Tracker de desarrollo
│   └── configuracion/   # Ajustes del sistema
├── components/
│   ├── layout/          # AppShell, Sidebar, Header
│   ├── providers/       # AuthProvider
│   ├── recepcion/       # DamageSelector, Checklist, FuelSelector
│   └── clientes/        # ClienteModal
├── lib/
│   ├── firebase.ts      # Configuración Firebase
│   └── services.ts      # Todos los servicios Firestore/Storage
├── store/
│   └── index.ts         # Zustand stores (auth, UI, recepcion)
└── types/
    └── index.ts         # Todos los tipos TypeScript
```

---

## 🗃️ Estructura Firestore

```
clientes/           → id, nombre, apellido, identificacion, telefono, email, direccion
vehiculos/          → id, clienteId, placa, marca, modelo, anio, color, vin, tipoVehiculo
ordenesTrabajo/     → id, vehiculoId, clienteId, estado, tipoServicio, motivo, km, combustible...
  └── itemsOrden/   → (subcolección) descripcion, cantidad, precioUnitario, impuesto, subtotal
pagos/              → id, ordenId, monto, metodoPago, referencia, createdAt
usuarios/           → uid, email, displayName, role, activo
```

---

## ✅ Módulos Completados

- ✅ Autenticación con roles
- ✅ Dashboard con métricas en tiempo real
- ✅ Módulo de Recepción (wizard 4 pasos)
  - 🔍 Buscador por placa
  - 🗺️ Selector visual de daños (SVG interactivo)
  - ✔️ Checklist de inventario
  - ⛽ Selector de nivel de combustible
- ✅ Gestión de Órdenes (lista, filtros, detalle)
- ✅ Items de Orden (productos y servicios con IVA)
- ✅ Carga de fotos a Firebase Storage
- ✅ Informe Técnico por orden
- ✅ Integración WhatsApp (botón de envío con mensaje formateado)
- ✅ Gestión de Clientes (CRUD)
- ✅ Gestión de Vehículos (CRUD)
- ✅ Módulo de Cobros y Pagos (abonos + historial)
- ✅ Módulo de Progreso de Desarrollo
- ✅ PWA Manifest (instalable)

## 🔄 Próximos Pasos

- 📄 Generador de PDF (@react-pdf/renderer)
- 💬 Plantillas de WhatsApp personalizables
- 👤 Panel de gestión de usuarios y roles
- 📊 Reportes e informes financieros
- 🔔 Notificaciones push PWA
