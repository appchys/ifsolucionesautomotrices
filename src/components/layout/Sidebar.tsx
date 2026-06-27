"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Columns3, Users, Car, CreditCard,
  Settings, Wrench, LogOut, Package, ShoppingCart, BarChart3,
  FileDown, FileText, Receipt, Menu, MessageSquare
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore, useUIStore, useChatStore } from "@/store";
import { toast } from "react-hot-toast";
import { getDatosTaller } from "@/lib/services";
import type { DatosTaller } from "@/types";

const navGroups = [
  {
    id: "g1",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin","recepcion","tecnico","contador"] },
      { href: "/ordenes/tablero", label: "Tablero", icon: Columns3, roles: ["admin","recepcion","tecnico","contador"] },
    ]
  },
  {
    id: "g2",
    items: [
      { href: "/ingresos", label: "Ingresos", icon: FileDown, roles: ["admin","recepcion"] },
      { href: "/presupuestos", label: "Presupuestos", icon: FileText, roles: ["admin","recepcion"] },
      { href: "/ordenes", label: "Órdenes", icon: Wrench, roles: ["admin","recepcion","tecnico","contador"], colorClass: "text-blue-600 dark:text-blue-400" },
      { href: "/ventas", label: "Ventas", icon: Receipt, roles: ["admin","recepcion","contador"] },
    ]
  },
  {
    id: "g3",
    items: [
      { href: "/compras", label: "Compras", icon: ShoppingCart, roles: ["admin","contador"] },
      { href: "/inventario", label: "Productos y Servicios", icon: Package, roles: ["admin","recepcion","contador"] },
      { href: "/clientes", label: "Clientes", icon: Users, roles: ["admin","recepcion","contador"] },
      { href: "/vehiculos", label: "Vehículos", icon: Car, roles: ["admin","recepcion"] },
    ]
  },
  {
    id: "g4",
    items: [
      { href: "/pagos", label: "Cobros y Pagos", icon: CreditCard, roles: ["admin","contador"] },
      { href: "/reporte-financiero", label: "Reporte Financiero", icon: BarChart3, roles: ["admin","contador"] },
      { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { 
    sidebarOpen, 
    toggleSidebar,
    setIngresoSidebarOpen,
    setOrdenSidebarOpen,
    setPresupuestoSidebarOpen
  } = useUIStore();
  const { isInboxOpen, toggleInbox, unreadCount } = useChatStore();
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

  const filteredGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => !user?.role || item.roles.includes(user.role))
  })).filter(group => group.items.length > 0);

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
        className={`app-sidebar fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300 ${
          sidebarOpen ? "sidebar-open" : "sidebar-collapsed"
        }`}
        style={{
          background: "var(--bg-secondary)",
          overflow: "hidden",
        }}
      >
        <div 
          className="flex flex-col h-full transition-all duration-300"
          style={{ width: sidebarOpen ? "260px" : "70px" }}
        >
          {/* Logo / Header */}
          <div 
            className={`flex items-center border-b flex-shrink-0 transition-all duration-300 ${
              sidebarOpen ? "justify-between px-5" : "justify-center px-0"
            }`}
            style={{ 
              borderColor: "var(--border)",
              height: "var(--header-height)", 
            }}
          >
            {sidebarOpen ? (
              <>
                <div className="flex items-center gap-3 min-w-0 animate-fade-in">
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
                <button
                  onClick={toggleSidebar}
                  className="btn-ghost btn-icon text-secondary hover:text-primary flex-shrink-0"
                  aria-label="Contraer menú"
                >
                  <Menu size={20} />
                </button>
              </>
            ) : (
              <button
                onClick={toggleSidebar}
                className="btn-ghost btn-icon text-secondary hover:text-primary flex-shrink-0 w-10 h-10 rounded-xl"
                aria-label="Expandir menú"
              >
                <Menu size={20} />
              </button>
            )}
          </div>

          {/* User chip */}
          {user && (
            <div 
              className={`mx-3 mt-4 mb-1 rounded-xl transition-all duration-300 flex items-center gap-2.5 ${
                sidebarOpen ? "px-3 py-2.5" : "px-[7px] py-2.5"
              }`} 
              style={{ background: "var(--bg-hover)" }}
              title={sidebarOpen ? undefined : `${user.displayName} (${user.role})`}
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {user.displayName?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <div 
                className={`min-w-0 transition-all duration-300 ${
                  sidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0 overflow-hidden pointer-events-none"
                }`}
              >
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {user.displayName}
                </p>
                <p className="text-xs capitalize mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {user.role}
                </p>
              </div>
            </div>
          )}

          {/* Chat Inbox Button */}
          {user && (
            <div className={`transition-all duration-300 ${sidebarOpen ? "px-3" : "px-2"}`}>
              <button
                id="sidebar-chat-toggle"
                onClick={toggleInbox}
                className={`sidebar-link w-full ${isInboxOpen ? "active" : ""} ${
                  sidebarOpen ? "px-3" : "px-[18px]"
                }`}
                title={sidebarOpen ? undefined : "Bandeja de Chats"}
              >
                <div className="relative flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={18} />
                  {!sidebarOpen && unreadCount > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-600 border border-[#111827] shadow-sm animate-pulse-glow"
                    />
                  )}
                </div>
                <span
                  className={`transition-all duration-300 whitespace-nowrap text-left flex-1 flex justify-between items-center ${
                    sidebarOpen ? "opacity-100 ml-0" : "opacity-0 ml-4 pointer-events-none"
                  }`}
                  style={{
                    transitionDelay: sidebarOpen ? "50ms" : "0ms"
                  }}
                >
                  <span>Bandeja de Chats</span>
                  {unreadCount > 0 && (
                    <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm ml-1.5 animate-fade-in">
                      {unreadCount}
                    </span>
                  )}
                </span>
              </button>
            </div>
          )}


          {/* Nav */}
          <nav className={`flex-1 py-2 flex flex-col gap-1.5 overflow-y-auto transition-all duration-300 ${sidebarOpen ? "px-3" : "px-2"}`}>
            {filteredGroups.map((group, groupIdx) => (
              <div key={group.id} className="flex flex-col gap-0.5">
                {groupIdx > 0 && (
                  <div 
                    className="border-t opacity-15 my-1.5 transition-all duration-300"
                    style={{ borderColor: "var(--border)" }}
                  />
                )}
                {group.items.map((item) => {
                  const active = item.href === "/ordenes"
                    ? pathname === "/ordenes" || (pathname.startsWith("/ordenes/") && !pathname.startsWith("/ordenes/tablero"))
                    : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-link ${active ? "active" : ""} ${sidebarOpen ? "px-3" : "px-[18px]"}`}
                      title={sidebarOpen ? undefined : item.label}
                      onClick={() => {
                        if (window.innerWidth < 1024) toggleSidebar();
                        setIngresoSidebarOpen(false);
                        setOrdenSidebarOpen(false);
                        setPresupuestoSidebarOpen(false);
                      }}
                    >
                      <item.icon size={18} className={`flex-shrink-0 ${(item as any).colorClass || ""}`} />
                      <span 
                        className={`transition-all duration-300 whitespace-nowrap ${
                          sidebarOpen ? "opacity-100 ml-0" : "opacity-0 ml-4 pointer-events-none"
                        }`}
                        style={{
                          transitionDelay: sidebarOpen ? "50ms" : "0ms"
                        }}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Logout */}
          <div className={`pb-5 border-t pt-3 flex-shrink-0 transition-all duration-300 ${sidebarOpen ? "px-3" : "px-2"}`} style={{ borderColor: "var(--border)" }}>
            <button 
              onClick={handleLogout} 
              className={`sidebar-link w-full ${sidebarOpen ? "px-3" : "px-[18px]"}`}
              title={sidebarOpen ? undefined : "Cerrar sesión"}
            >
              <LogOut size={18} className="flex-shrink-0" />
              <span 
                className={`transition-all duration-300 whitespace-nowrap ${
                  sidebarOpen ? "opacity-100 ml-0" : "opacity-0 ml-4 pointer-events-none"
                }`}
                style={{
                  transitionDelay: sidebarOpen ? "50ms" : "0ms"
                }}
              >
                Cerrar sesión
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
