"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Columns3, Users, Car, CreditCard,
  Settings, Wrench, LogOut, Package, ShoppingCart, BarChart3,
  FileDown, FileText, Receipt
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore, useUIStore } from "@/store";
import { toast } from "react-hot-toast";
import { getDatosTaller } from "@/lib/services";
import type { DatosTaller } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin","recepcion","tecnico","contador"] },
  { href: "/ingresos", label: "Ingresos", icon: FileDown, roles: ["admin","recepcion"] },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText, roles: ["admin","recepcion"] },
  { href: "/ordenes", label: "Órdenes", icon: ClipboardList, roles: ["admin","recepcion","tecnico","contador"] },
  { href: "/ordenes/tablero", label: "Tablero", icon: Columns3, roles: ["admin","recepcion","tecnico","contador"] },
  { href: "/ventas", label: "Ventas", icon: Receipt, roles: ["admin","recepcion","contador"] },
  { href: "/clientes", label: "Clientes", icon: Users, roles: ["admin","recepcion","contador"] },
  { href: "/vehiculos", label: "Vehículos", icon: Car, roles: ["admin","recepcion"] },
  { href: "/inventario", label: "Productos y Servicios", icon: Package, roles: ["admin","recepcion","contador"] },
  { href: "/compras", label: "Compras", icon: ShoppingCart, roles: ["admin","contador"] },
  { href: "/pagos", label: "Cobros y Pagos", icon: CreditCard, roles: ["admin","contador"] },
  { href: "/reporte-financiero", label: "Reporte Financiero", icon: BarChart3, roles: ["admin","contador"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [datosTaller, setDatosTaller] = useState<DatosTaller | null>(null);

  useEffect(() => {
    getDatosTaller().then(setDatosTaller).catch(console.error);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    router.replace("/login");
    toast.success("Sesión cerrada");
  };

  const filtered = navItems.filter(
    (item) => !user?.role || item.roles.includes(user.role)
  );

  return (
    <>
      {/* Overlay for narrow layouts where the sidebar floats over the app */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        id="app-sidebar"
        className="app-sidebar fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300"
        style={{
          width: sidebarOpen ? "260px" : "0px",
          overflow: "hidden",
          background: "var(--bg-secondary)",
          borderRight: sidebarOpen ? "1px solid var(--border)" : "none",
          boxShadow: sidebarOpen ? "var(--shadow-lg)" : "none",
        }}
      >
        <div style={{ width: "260px" }} className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ 
                background: datosTaller?.logoUrl ? "transparent" : "var(--accent)",
                boxShadow: datosTaller?.logoUrl ? "none" : "0 0 12px var(--accent-alpha)" 
              }}
            >
              {datosTaller?.logoUrl ? (
                <img src={datosTaller.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Wrench size={18} className="text-white" />
              )}
            </div>
            <div className="min-w-0">
              <p 
                className="text-sm font-bold leading-tight line-clamp-2" 
                style={{ color: "var(--text-primary)" }}
              >
                {datosTaller?.razonSocial || "I.F. Soluciones"}
              </p>
            </div>
          </div>

          {/* User chip */}
          {user && (
            <div className="mx-3 mt-4 mb-1 px-3 py-2.5 rounded-xl" style={{ background: "var(--bg-hover)" }}>
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {user.displayName}
              </p>
              <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                {user.role}
              </p>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
            {filtered.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${active ? "active" : ""}`}
                  onClick={() => {
                    if (window.innerWidth < 1024) toggleSidebar();
                  }}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="px-3 pb-5 border-t pt-3 flex-shrink-0" style={{ borderColor: "var(--border)" }}>
            <button onClick={handleLogout} className="sidebar-link w-full">
              <LogOut size={18} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
