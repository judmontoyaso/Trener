"use client";

import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Target, 
  Calendar, 
  Dumbbell,
  BarChart3,
  Activity,
  Trophy,
  ChevronDown
} from "lucide-react";

interface ProgresoEjercicio {
  fecha: string;
  peso: number;
  series: number;
  repeticiones: number | number[];
}

interface VolumenSemanal {
  semana: string;
  series: number;
  ejercicios: number;
  entrenamientos: number;
}

interface GrupoData {
  entrenamientos: number;
  series: number;
}

interface EjercicioFrecuente {
  nombre: string;
  veces: number;
  ultimo_peso: number | null;
  max_peso: number;
  promedio_peso?: number;
}

export default function ProgresoPage() {
  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState("");
  const [progresoEjercicio, setProgresoEjercicio] = useState<ProgresoEjercicio[]>([]);
  const [volumenSemanal, setVolumenSemanal] = useState<VolumenSemanal[]>([]);
  const [porGrupo, setPorGrupo] = useState<Record<string, GrupoData>>({});
  const [ejerciciosFrecuentes, setEjerciciosFrecuentes] = useState<EjercicioFrecuente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (ejercicioSeleccionado) {
      cargarProgresoEjercicio(ejercicioSeleccionado);
    }
  }, [ejercicioSeleccionado]);

  async function cargarDatos() {
    try {
      const [volumenRes, gruposRes, frecuentesRes] = await Promise.all([
        fetch("http://localhost:8000/api/progreso/volumen"),
        fetch("http://localhost:8000/api/progreso/grupos"),
        fetch("http://localhost:8000/api/progreso/ejercicios-frecuentes")
      ]);

      const volumenData = await volumenRes.json();
      const gruposData = await gruposRes.json();
      const frecuentesData = await frecuentesRes.json();

      setVolumenSemanal(volumenData.volumen_semanal || []);
      setPorGrupo(gruposData.por_grupo || {});
      setEjerciciosFrecuentes(frecuentesData.ejercicios || []);

      // Seleccionar primer ejercicio por defecto
      if (frecuentesData.ejercicios?.length > 0) {
        setEjercicioSeleccionado(frecuentesData.ejercicios[0].nombre);
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  }

  async function cargarProgresoEjercicio(nombre: string) {
    try {
      const res = await fetch(`http://localhost:8000/api/progreso/ejercicio/${encodeURIComponent(nombre)}`);
      const data = await res.json();
      setProgresoEjercicio(data.progreso || []);
    } catch (error) {
      console.error("Error cargando progreso:", error);
    }
  }

  // Calcular métricas
  const totalEntrenamientos = volumenSemanal.reduce((sum, s) => sum + s.entrenamientos, 0);
  const totalSeries = volumenSemanal.reduce((sum, s) => sum + s.series, 0);
  const promedioSemana = volumenSemanal.length > 0 
    ? Math.round(totalEntrenamientos / volumenSemanal.length * 10) / 10 
    : 0;

  // Calcular progreso del ejercicio seleccionado
  const calcularProgreso = () => {
    if (progresoEjercicio.length < 2) return null;
    const primero = progresoEjercicio[0].peso;
    const ultimo = progresoEjercicio[progresoEjercicio.length - 1].peso;
    const diferencia = ultimo - primero;
    const porcentaje = Math.round((diferencia / primero) * 100);
    return { diferencia, porcentaje };
  };

  const progreso = calcularProgreso();
  const maxPeso = progresoEjercicio.length > 0 
    ? Math.max(...progresoEjercicio.map(p => p.peso)) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
        <BarChart3 className="text-emerald-400" />
        Tu Progreso
      </h1>
      <p className="text-gray-400 mb-8">Visualiza tu evolución en el gimnasio</p>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Calendar className="w-4 h-4" />
            Total Entrenamientos
          </div>
          <div className="text-2xl font-bold text-white">{totalEntrenamientos}</div>
        </div>
        
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Activity className="w-4 h-4" />
            Total Series
          </div>
          <div className="text-2xl font-bold text-white">{totalSeries}</div>
        </div>
        
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Promedio/Semana
          </div>
          <div className="text-2xl font-bold text-emerald-400">{promedioSemana}</div>
        </div>
        
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Target className="w-4 h-4" />
            Grupos Trabajados
          </div>
          <div className="text-2xl font-bold text-white">{Object.keys(porGrupo).length}</div>
        </div>
      </div>

      {/* Gráfica de volumen semanal */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Volumen Semanal
        </h2>
        
        <div className="flex items-end gap-2 h-40 overflow-x-auto pb-4">
          {volumenSemanal.slice(-12).map((semana, i) => {
            const maxSeries = Math.max(...volumenSemanal.map(s => s.series));
            const height = (semana.series / maxSeries) * 100;
            
            return (
              <div 
                key={i} 
                className="flex flex-col items-center min-w-[60px] group"
              >
                <div className="relative w-full">
                  <div 
                    className="w-full bg-emerald-600 rounded-t-md transition-all hover:bg-emerald-500 cursor-pointer"
                    style={{ height: `${Math.max(height, 5)}%`, minHeight: '8px' }}
                  />
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-xs px-2 py-1 rounded whitespace-nowrap">
                    {semana.series} series
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 truncate w-full text-center">
                  {new Date(semana.semana).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progreso por ejercicio */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-emerald-400" />
          Progreso por Ejercicio
        </h2>

        {/* Selector de ejercicio */}
        <div className="relative mb-6">
          <select
            value={ejercicioSeleccionado}
            onChange={(e) => setEjercicioSeleccionado(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white appearance-none cursor-pointer focus:outline-none focus:border-emerald-500"
          >
            {ejerciciosFrecuentes.map((ej, i) => (
              <option key={i} value={ej.nombre}>
                {ej.nombre} ({ej.veces} veces)
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {/* Métricas del ejercicio */}
        {progresoEjercicio.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-sm">Máximo</div>
                <div className="text-xl font-bold text-yellow-400">{maxPeso}kg</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-sm">Último</div>
                <div className="text-xl font-bold text-white">
                  {progresoEjercicio[progresoEjercicio.length - 1]?.peso}kg
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-sm">Progreso</div>
                <div className={`text-xl font-bold ${progreso && progreso.diferencia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {progreso ? `${progreso.diferencia >= 0 ? '+' : ''}${progreso.diferencia}kg` : '-'}
                </div>
              </div>
            </div>

            {/* Mini gráfica de progreso */}
            <div className="flex items-end gap-1 h-24 overflow-x-auto">
              {progresoEjercicio.slice(-20).map((p, i) => {
                const height = (p.peso / maxPeso) * 100;
                return (
                  <div 
                    key={i} 
                    className="flex flex-col items-center min-w-[30px] group"
                  >
                    <div 
                      className="w-full bg-blue-500 rounded-t-sm hover:bg-blue-400 transition-all cursor-pointer relative"
                      style={{ height: `${Math.max(height, 10)}%` }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {p.peso}kg - {p.fecha}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Distribución por grupo muscular */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-400" />
          Distribución por Grupo Muscular
        </h2>

        <div className="space-y-3">
          {Object.entries(porGrupo)
            .sort((a, b) => b[1].entrenamientos - a[1].entrenamientos)
            .map(([grupo, data]) => {
              const maxEntrenamientos = Math.max(...Object.values(porGrupo).map(g => g.entrenamientos));
              const porcentaje = (data.entrenamientos / maxEntrenamientos) * 100;
              
              return (
                <div key={grupo} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{grupo}</span>
                    <span className="text-gray-400">{data.entrenamientos} entrenamientos</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Ejercicios más frecuentes */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-emerald-400" />
          Ejercicios Más Frecuentes
        </h2>

        <div className="space-y-3">
          {ejerciciosFrecuentes.slice(0, 10).map((ej, i) => (
            <div 
              key={i}
              className="flex items-center gap-4 bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors cursor-pointer"
              onClick={() => setEjercicioSeleccionado(ej.nombre)}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                i === 1 ? 'bg-gray-400/20 text-gray-300' :
                i === 2 ? 'bg-orange-600/20 text-orange-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{ej.nombre}</div>
                <div className="text-sm text-gray-400">{ej.veces} veces</div>
              </div>
              <div className="text-right">
                {ej.max_peso > 0 && (
                  <>
                    <div className="font-bold text-emerald-400">{ej.max_peso}kg</div>
                    <div className="text-xs text-gray-500">máx</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
