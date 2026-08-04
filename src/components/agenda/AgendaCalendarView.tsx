"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Car,
  Wrench,
  Plus,
  User,
  Filter,
} from "lucide-react";
import { EventoAgenda } from "./ModalDetalleEvento";

interface AgendaCalendarViewProps {
  eventos: EventoAgenda[];
  onSeleccionarEvento: (evento: EventoAgenda) => void;
  onCrearCitaEnFecha: (fechaStr: string) => void;
}

export default function AgendaCalendarView({
  eventos,
  onSeleccionarEvento,
  onCrearCitaEnFecha,
}: AgendaCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Formatear mes y año
  const monthYearStr = currentDate.toLocaleDateString("es-EC", {
    month: "long",
    year: "numeric",
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Días del calendario
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0: Dom, 1: Lun...
    const daysInMonth = lastDayOfMonth.getDate();

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Días del mes anterior para rellenar
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({ date: d, dateStr, isCurrentMonth: false });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      // Evitar desfase por timezone local
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, "0");
      const dayStr = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
      days.push({ date: d, dateStr, isCurrentMonth: true });
    }

    // Días del siguiente mes para completar la cuadrícula (múltiplo de 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, "0");
      const dayStr = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
      days.push({ date: d, dateStr, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Mapeo de eventos por fecha (YYYY-MM-DD)
  const eventosMap = useMemo(() => {
    const map: Record<string, EventoAgenda[]> = {};
    eventos.forEach((ev) => {
      if (!ev.fecha) return;
      if (!map[ev.fecha]) map[ev.fecha] = [];
      map[ev.fecha].push(ev);
    });
    return map;
  }, [eventos]);

  // Hoy string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
      {/* Navigation Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-extrabold capitalize text-slate-800 dark:text-slate-100 tracking-tight">
            {monthYearStr}
          </h2>
          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer transition-colors"
          >
            Hoy
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Leyenda de colores explícita */}
          <div className="hidden md:flex items-center gap-3 text-[11px] font-semibold pr-2 border-r border-slate-200 dark:border-slate-700">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Citas Agendadas
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span>
              Entregas de Órdenes
            </span>
          </div>

          {/* Botones Mes Ant / Sig */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border-0 bg-transparent cursor-pointer transition-colors"
              title="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border-0 bg-transparent cursor-pointer transition-colors"
              title="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Leyenda móvil si es pantalla pequeña */}
      <div className="flex md:hidden items-center justify-center gap-3 text-[10px] font-semibold py-2 px-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
        <span className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          Citas
        </span>
        <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300">
          <span className="w-2 h-2 rounded-full bg-purple-600"></span>
          Entregas Órdenes
        </span>
      </div>

      {/* Días de la semana Header */}
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-center font-bold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider py-2">
        <div>Dom</div>
        <div>Lun</div>
        <div>Mar</div>
        <div>Mié</div>
        <div>Jue</div>
        <div>Vie</div>
        <div>Sáb</div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80 min-h-[500px]">
        {calendarDays.map((dayObj) => {
          const { date, dateStr, isCurrentMonth } = dayObj;
          const dayEvents = eventosMap[dateStr] || [];
          const isToday = dateStr === todayStr;

          return (
            <div
              key={dateStr}
              className={`p-1.5 sm:p-2 flex flex-col justify-between transition-colors min-h-[90px] sm:min-h-[105px] group ${
                isCurrentMonth
                  ? "bg-white dark:bg-slate-900"
                  : "bg-slate-50/50 dark:bg-slate-950/40 opacity-50"
              } ${isToday ? "ring-2 ring-blue-500/40 ring-inset bg-blue-50/20 dark:bg-blue-950/10" : ""}`}
            >
              {/* Header del Día */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className={`text-[11px] font-extrabold w-6 h-6 rounded-full flex items-center justify-center ${
                    isToday
                      ? "bg-blue-600 text-white shadow-2xs"
                      : isCurrentMonth
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {date.getDate()}
                </span>

                {/* Botón rápido agendar cita en este día */}
                <button
                  type="button"
                  onClick={() => onCrearCitaEnFecha(dateStr)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md border-0 bg-transparent cursor-pointer transition-all"
                  title={`Agendar cita el ${dateStr}`}
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* Badges de Eventos */}
              <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] scrollbar-thin">
                {dayEvents.map((ev) => {
                  const isCita = ev.tipo === "cita";
                  return (
                    <div
                      key={ev.id}
                      onClick={() => onSeleccionarEvento(ev)}
                      className={`p-1 sm:p-1.5 rounded-lg border text-[10px] font-semibold cursor-pointer transition-all hover:scale-[1.01] hover:shadow-2xs leading-tight truncate flex items-center gap-1 ${
                        isCita
                          ? "bg-blue-50/90 text-blue-900 border-blue-200 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-800 hover:bg-blue-100"
                          : "bg-purple-50/90 text-purple-900 border-purple-200 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-800 hover:bg-purple-100"
                      }`}
                      title={`${isCita ? "Cita" : "Entrega"}: ${ev.titulo} (${ev.estado})`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isCita ? "bg-blue-600" : "bg-purple-600"
                        }`}
                      ></span>
                      <span className="font-extrabold shrink-0">
                        {ev.horaInicio ? ev.horaInicio : isCita ? "Cita" : "Entrega"}
                      </span>
                      <span className="truncate">{ev.titulo}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
