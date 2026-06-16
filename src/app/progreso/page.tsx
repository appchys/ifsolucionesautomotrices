"use client";
import AppShell from "@/components/layout/AppShell";
import { DevFeature, FeatureStatus } from "@/types";
import { CheckCircle2, Clock, AlertCircle, Activity } from "lucide-react";

const FEATURES: DevFeature[] = [
  // Completado
  { nombre: "Autenticación Firebase", descripcion: "Login con email/contraseña y roles de usuario", estado: "Completo", modulo: "Auth" },
  { nombre: "Configuración Firebase", descripcion: "Firestore, Storage y Auth configurados", estado: "Completo", modulo: "Backend" },
  { nombre: "Arquitectura de Datos", descripcion: "Colecciones: clientes, vehiculos, ordenesTrabajo, pagos", estado: "Completo", modulo: "Backend" },
  { nombre: "Módulo de Recepción", descripcion: "Wizard de 4 pasos: búsqueda por placa, cliente, vehículo, orden", estado: "Completo", modulo: "Recepción" },
  { nombre: "Selector de Daños", descripcion: "Diagrama SVG interactivo del vehículo para marcar daños", estado: "Completo", modulo: "Recepción" },
  { nombre: "Checklist de Inventario", descripcion: "Antenas, botiquín, extintor, herramientas, llave de rueda, etc.", estado: "Completo", modulo: "Recepción" },
  { nombre: "Selector de Combustible", descripcion: "Selector visual de nivel de combustible con colores", estado: "Completo", modulo: "Recepción" },
  { nombre: "Dashboard Principal", descripcion: "Estadísticas en tiempo real, estado de órdenes, tabla reciente", estado: "Completo", modulo: "Dashboard" },
  { nombre: "Gestión de Órdenes", descripcion: "Lista, búsqueda, filtros y cambio de estado inline", estado: "Completo", modulo: "Órdenes" },
  { nombre: "Detalle de Orden", descripcion: "Vista completa con items, fotos, informe técnico", estado: "Completo", modulo: "Órdenes" },
  { nombre: "Gestión de Clientes", descripcion: "CRUD completo con modal y tarjetas visuales", estado: "Completo", modulo: "Clientes" },
  { nombre: "Módulo de Pagos", descripcion: "Abonos, saldo pendiente e historial por orden", estado: "Completo", modulo: "Pagos" },
  { nombre: "Módulo de Progreso Dev", descripcion: "Vista del avance del desarrollo de la aplicación", estado: "Completo", modulo: "Dev" },
  { nombre: "PWA Manifest", descripcion: "App instalable con ícono y tema oscuro", estado: "Completo", modulo: "PWA" },
  { nombre: "Diseño Responsivo", descripcion: "Adaptado para laptop y móviles de técnicos", estado: "Completo", modulo: "UI/UX" },
  { nombre: "Sidebar con roles", descripcion: "Menú lateral filtrado por rol de usuario", estado: "Completo", modulo: "UI/UX" },

  // En proceso
  { nombre: "Generador de PDF", descripcion: "PDF de orden de trabajo e informe técnico final con @react-pdf", estado: "En proceso", modulo: "Reportes" },
  { nombre: "Carga de Fotos", descripcion: "Upload de imágenes a Firebase Storage con preview", estado: "En proceso", modulo: "Órdenes" },
  { nombre: "Módulo de Vehículos", descripcion: "Lista y gestión independiente de vehículos por cliente", estado: "En proceso", modulo: "Vehículos" },

  // Pendiente
  { nombre: "Integración WhatsApp", descripcion: "Botón para enviar estado o PDF al cliente vía API", estado: "Pendiente", modulo: "Integración" },
  { nombre: "Plantillas WhatsApp", descripcion: "Editor de mensajes personalizables por tipo de estado", estado: "Pendiente", modulo: "Integración" },
  { nombre: "Gestión de Usuarios", descripcion: "Panel de admin para crear y gestionar usuarios y roles", estado: "Pendiente", modulo: "Admin" },
  { nombre: "Informes y Reportes", descripcion: "Estadísticas de ingresos, órdenes y técnicos", estado: "Pendiente", modulo: "Admin" },
  { nombre: "Notificaciones Push", descripcion: "Alertas cuando cambia el estado de una orden", estado: "Pendiente", modulo: "PWA" },
  { nombre: "Modo Offline PWA", descripcion: "Caché de datos para uso sin conexión en el taller", estado: "Pendiente", modulo: "PWA" },
];

const STATUS_CONFIG: Record<FeatureStatus, { icon: React.ElementType; badge: string; color: string }> = {
  Completo: { icon: CheckCircle2, badge: "badge-green", color: "var(--success)" },
  "En proceso": { icon: Clock, badge: "badge-yellow", color: "var(--warning)" },
  Pendiente: { icon: AlertCircle, badge: "badge-gray", color: "var(--text-muted)" },
};

export default function ProgresoPage() {
  const completos = FEATURES.filter((f) => f.estado === "Completo").length;
  const enProceso = FEATURES.filter((f) => f.estado === "En proceso").length;
  const pendientes = FEATURES.filter((f) => f.estado === "Pendiente").length;
  const pct = Math.round((completos / FEATURES.length) * 100);

  const modulos = Array.from(new Set(FEATURES.map((f) => f.modulo)));

  return (
    <AppShell>
      <div className="page-header flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(37,99,235,0.12)" }}
        >
          <Activity size={24} style={{ color: "var(--accent-light)" }} />
        </div>
        <div>
          <h1 className="page-title">Progreso de Desarrollo</h1>
          <p className="page-subtitle">I.F. Soluciones Automotrices — Estado del sistema</p>
        </div>
      </div>

      {/* Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Progreso General
          </h2>
          <span className="text-2xl font-bold gradient-text">{pct}%</span>
        </div>
        <div className="progress-bar h-3 mb-4">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Completados", value: completos, badge: "badge-green", icon: CheckCircle2, color: "var(--success)" },
            { label: "En Proceso", value: enProceso, badge: "badge-yellow", icon: Clock, color: "var(--warning)" },
            { label: "Pendientes", value: pendientes, badge: "badge-gray", icon: AlertCircle, color: "var(--text-muted)" },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
              <s.icon size={20} className="mx-auto mb-1" style={{ color: s.color }} />
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features by module */}
      <div className="space-y-6">
        {modulos.map((modulo) => {
          const moduloFeatures = FEATURES.filter((f) => f.modulo === modulo);
          return (
            <div key={modulo} className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className="badge badge-blue">{modulo}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {moduloFeatures.filter((f) => f.estado === "Completo").length}/{moduloFeatures.length} completados
                </span>
              </div>
              <div className="space-y-2">
                {moduloFeatures.map((f) => {
                  const cfg = STATUS_CONFIG[f.estado];
                  return (
                    <div
                      key={f.nombre}
                      className="flex items-start gap-3 p-3 rounded-lg"
                      style={{ background: "var(--bg-secondary)" }}
                    >
                      <cfg.icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {f.nombre}
                          </span>
                          <span className={`badge badge-sm ${cfg.badge}`}>{f.estado}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {f.descripcion}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
