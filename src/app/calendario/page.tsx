'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { fetchEntrenamientos } from '@/lib/api';
import { Entrenamiento } from '@/types';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import WorkoutCard from '@/components/WorkoutCard';

export default function CalendarioPage() {
  const [entrenamientos, setEntrenamientos] = useState<Entrenamiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesActual, setMesActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchEntrenamientos();
        setEntrenamientos(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Crear mapa de entrenamientos por fecha
  const entrenamientosPorFecha = new Map<string, Entrenamiento[]>();
  entrenamientos.forEach((e) => {
    const fecha = e.fecha;
    if (!entrenamientosPorFecha.has(fecha)) {
      entrenamientosPorFecha.set(fecha, []);
    }
    entrenamientosPorFecha.get(fecha)!.push(e);
  });

  // Obtener días del mes actual
  const inicio = startOfWeek(startOfMonth(mesActual), { weekStartsOn: 1 });
  const fin = endOfWeek(endOfMonth(mesActual), { weekStartsOn: 1 });
  const diasDelMes = eachDayOfInterval({ start: inicio, end: fin });

  // Entrenamientos del día seleccionado
  const entrenamientosDelDia = diaSeleccionado
    ? entrenamientosPorFecha.get(format(diaSeleccionado, 'yyyy-MM-dd')) || []
    : [];

  const getTipoColor = (tipo: string) => {
    const colores: Record<string, string> = {
      push: 'bg-red-500',
      pull: 'bg-blue-500',
      pierna: 'bg-green-500',
      hombro: 'bg-purple-500',
    };
    return colores[tipo] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-gym-purple" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Calendario</h1>
          <p className="text-gray-400">Visualiza tus entrenamientos por fecha</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Calendario */}
          <div className="lg:col-span-2">
            <div className="bg-gym-dark/50 rounded-xl border border-white/10 p-6">
              {/* Header del calendario */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setMesActual(subMonths(mesActual, 1))}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-400" />
                </button>
                <h2 className="text-xl font-semibold text-white capitalize">
                  {format(mesActual, 'MMMM yyyy', { locale: es })}
                </h2>
                <button
                  onClick={() => setMesActual(addMonths(mesActual, 1))}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => (
                  <div key={dia} className="text-center text-sm text-gray-500 py-2">
                    {dia}
                  </div>
                ))}
              </div>

              {/* Días del mes */}
              <div className="grid grid-cols-7 gap-1">
                {diasDelMes.map((dia) => {
                  const fechaStr = format(dia, 'yyyy-MM-dd');
                  const entrenamientosDelDia = entrenamientosPorFecha.get(fechaStr) || [];
                  const tieneEntrenamiento = entrenamientosDelDia.length > 0;
                  const esHoy = isSameDay(dia, new Date());
                  const esDelMes = isSameMonth(dia, mesActual);
                  const estaSeleccionado = diaSeleccionado && isSameDay(dia, diaSeleccionado);

                  return (
                    <button
                      key={fechaStr}
                      onClick={() => setDiaSeleccionado(dia)}
                      className={clsx(
                        'aspect-square p-1 rounded-lg transition-all relative',
                        !esDelMes && 'opacity-30',
                        esHoy && 'ring-2 ring-gym-accent',
                        estaSeleccionado && 'bg-gym-purple',
                        !estaSeleccionado && 'hover:bg-white/10'
                      )}
                    >
                      <span
                        className={clsx(
                          'text-sm',
                          estaSeleccionado ? 'text-white' : 'text-gray-300'
                        )}
                      >
                        {format(dia, 'd')}
                      </span>
                      {tieneEntrenamiento && (
                        <div className="flex gap-0.5 justify-center mt-1 flex-wrap">
                          {entrenamientosDelDia.slice(0, 3).map((e, i) => (
                            <div
                              key={i}
                              className={clsx('w-1.5 h-1.5 rounded-full', getTipoColor(e.tipo))}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Leyenda */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-sm text-gray-400 mb-2">Leyenda:</p>
                <div className="flex flex-wrap gap-4">
                  {[
                    { tipo: 'push', label: 'Push' },
                    { tipo: 'pull', label: 'Pull' },
                    { tipo: 'pierna', label: 'Pierna' },
                    { tipo: 'hombro', label: 'Hombro' },
                  ].map(({ tipo, label }) => (
                    <div key={tipo} className="flex items-center gap-2">
                      <div className={clsx('w-3 h-3 rounded-full', getTipoColor(tipo))} />
                      <span className="text-sm text-gray-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Panel lateral */}
          <div className="lg:col-span-1">
            <div className="bg-gym-dark/50 rounded-xl border border-white/10 p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-white mb-4">
                {diaSeleccionado
                  ? format(diaSeleccionado, "d 'de' MMMM", { locale: es })
                  : 'Selecciona un día'}
              </h3>

              {diaSeleccionado ? (
                entrenamientosDelDia.length > 0 ? (
                  <div className="space-y-4">
                    {entrenamientosDelDia.map((entrenamiento, index) => (
                      <WorkoutCard key={entrenamiento.id || index} entrenamiento={entrenamiento} />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No hay entrenamientos este día
                  </p>
                )
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Haz clic en un día para ver los entrenamientos
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
