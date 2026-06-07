"use client";

import { use, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import DatosTallerForm from "@/components/configuracion/DatosTallerForm";
import UsuariosManager from "@/components/configuracion/UsuariosManager";
import VehicleViewImagesManager from "@/components/configuracion/VehicleViewImagesManager";
import { Bell, Settings, Shield, SlidersHorizontal } from "lucide-react";

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

type ConfiguracionTab = "general" | "usuarios" | "avanzado";

type ConfiguracionSearchParams = Promise<{
  tab?: string | string[];
}>;

function getTabFromSearchParams(tab: string | string[] | undefined): ConfiguracionTab {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return value === "usuarios" || value === "avanzado" ? value : "general";
}

export default function ConfiguracionPage({
  searchParams,
}: {
  searchParams: ConfiguracionSearchParams;
}) {
  const initialTab = getTabFromSearchParams(use(searchParams).tab);
  const [activeTab, setActiveTab] = useState<ConfiguracionTab>(initialTab);

  return (
    <AppShell>
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">Ajustes del sistema y preferencias</p>
      </div>

      <div
        className="flex flex-wrap gap-2 p-1 rounded-lg border w-fit"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <button
          type="button"
          className={`btn-sm inline-flex items-center gap-2 rounded-lg transition-colors ${
            activeTab === "general" ? "btn-primary" : "btn-ghost"
          }`}
          onClick={() => setActiveTab("general")}
        >
          <Settings size={16} />
          General
        </button>
        <button
          type="button"
          className={`btn-sm inline-flex items-center gap-2 rounded-lg transition-colors ${
            activeTab === "usuarios" ? "btn-primary" : "btn-ghost"
          }`}
          onClick={() => setActiveTab("usuarios")}
        >
          <Shield size={16} />
          Usuarios
        </button>
        <button
          type="button"
          className={`btn-sm inline-flex items-center gap-2 rounded-lg transition-colors ${
            activeTab === "avanzado" ? "btn-primary" : "btn-ghost"
          }`}
          onClick={() => setActiveTab("avanzado")}
        >
          <SlidersHorizontal size={16} />
          Avanzado
        </button>
      </div>

      {activeTab === "general" ? (
        <>
          <DatosTallerForm />

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
        </>
      ) : activeTab === "usuarios" ? (
        <UsuariosManager />
      ) : (
        <VehicleViewImagesManager />
      )}
    </AppShell>
  );
}
