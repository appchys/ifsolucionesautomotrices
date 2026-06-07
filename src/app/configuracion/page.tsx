"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import DatosTallerForm from "@/components/configuracion/DatosTallerForm";
import UsuariosManager from "@/components/configuracion/UsuariosManager";
import VehicleViewImagesManager from "@/components/configuracion/VehicleViewImagesManager";
import { Bell, Car, Shield, Wrench } from "lucide-react";

const MODULOS_PROXIMOS = [
  {
    icon: Bell,
    title: "Notificaciones",
    desc: "Configurar alertas y mensajes automáticos",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    items: ["Alertas de cambio de estado", "Plantillas de WhatsApp", "Recordatorios de entrega"],
  },
];

const CONFIG_TABS = [
  { id: "taller", label: "Taller", icon: Wrench },
  { id: "usuarios", label: "Gestión de Usuarios", icon: Shield },
  { id: "vehiculos", label: "Vistas de Vehículos", icon: Car },
  { id: "notificaciones", label: "Notificaciones", icon: Bell },
] as const;

type ConfigTab = (typeof CONFIG_TABS)[number]["id"];

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>("taller");

  return (
    <AppShell>
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">Ajustes del sistema y preferencias</p>
      </div>

      <div
        role="tablist"
        aria-label="Secciones de configuración"
        className="flex gap-2 overflow-x-auto border-b pb-2"
        style={{ borderColor: "var(--border)" }}
      >
        {CONFIG_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`config-panel-${tab.id}`}
              id={`config-tab-${tab.id}`}
              className="btn btn-sm whitespace-nowrap"
              style={{
                background: selected ? "var(--accent)" : "var(--bg-card)",
                border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                color: selected ? "#fff" : "var(--text-secondary)",
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <section
        role="tabpanel"
        id={`config-panel-${activeTab}`}
        aria-labelledby={`config-tab-${activeTab}`}
      >
        {activeTab === "taller" ? <DatosTallerForm /> : null}
        {activeTab === "usuarios" ? <UsuariosManager /> : null}
        {activeTab === "vehiculos" ? <VehicleViewImagesManager /> : null}
        {activeTab === "notificaciones" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULOS_PROXIMOS.map((s) => (
              <div key={s.title} className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="stat-icon" style={{ background: s.bg }}>
                    <s.icon size={22} style={{ color: s.color }} />
                  </div>
                  <div>
                    <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {s.title}
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {s.desc}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {s.items.map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                      style={{ background: "var(--bg-secondary)" }}
                    >
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {item}
                      </span>
                      <span className="badge badge-gray text-xs">Próximamente</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
