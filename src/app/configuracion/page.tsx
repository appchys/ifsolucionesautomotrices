"use client";
import AppShell from "@/components/layout/AppShell";
import DatosTallerForm from "@/components/configuracion/DatosTallerForm";
import VehicleViewImagesManager from "@/components/setup/VehicleViewImagesManager";
import { Settings, Shield, Bell, Image as ImageIcon } from "lucide-react";

const MODULOS_PROXIMOS = [
  {
    icon: Shield,
    title: "Gestión de Usuarios",
    desc: "Roles y permisos del sistema",
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    items: ["Crear usuario", "Asignar rol (Admin, Recepción, Técnico, Contador)", "Activar / Desactivar cuenta"],
  },
  {
    icon: Bell,
    title: "Notificaciones",
    desc: "Configurar alertas y mensajes automáticos",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    items: ["Alertas de cambio de estado", "Plantillas de WhatsApp", "Recordatorios de entrega"],
  },
];

export default function ConfiguracionPage() {
  return (
    <AppShell>
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">Ajustes del sistema y preferencias</p>
      </div>

      <DatosTallerForm />

      {/* Sección de Imágenes de Vistas */}
      <div className="card mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="stat-icon" style={{ background: "rgba(59,130,246,0.12)" }}>
            <ImageIcon size={22} style={{ color: "#3b82f6" }} />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Imágenes de Vistas de Vehículos</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Administra las imágenes de cada vista que se usarán en inspecciones visuales</p>
          </div>
        </div>
        <VehicleViewImagesManager />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
        {MODULOS_PROXIMOS.map((s) => (
          <div key={s.title} className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="stat-icon" style={{ background: s.bg }}>
                <s.icon size={22} style={{ color: s.color }} />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.title}</h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
              </div>
            </div>
            <div className="space-y-2">
              {s.items.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{item}</span>
                  <span className="badge badge-gray text-xs">Próximamente</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>


    </AppShell>
  );
}
