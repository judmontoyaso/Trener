"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { 
  TrendingUp, 
  Target, 
  Calendar, 
  Dumbbell,
  BarChart3,
  Activity,
  Trophy,
  ChevronDown,
  Zap,
  ArrowUp,
  ArrowDown,
  Loader2
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

interface OnermData {
  ejercicio: string;
  peso_usado: number;
  repeticiones: number;
  rm_estimado: number;
  fecha: string;
}

export default function ProgresoPage() {
  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState("");
  const [progresoEjercicio, setProgresoEjercicio] = useState<ProgresoEjercicio[]>([]);
  const [volumenSemanal, setVolumenSemanal] = useState<VolumenSemanal[]>([]);
  const [porGrupo, setPorGrupo] = useState<Record<string, GrupoData>>({});
  const [ejerciciosFrecuentes, setEjerciciosFrecuentes] = useState<EjercicioFrecuente[]>([]);
  const [oneRmData, setOneRmData] = useState<OnermData[]>([]);
  const [comparativa, setComparativa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (ejercicioSeleccionado) {
      cargarProgresoEjercicio(ejercicioSeleccionado);
    }
  }, [ejercicioSeleccionado]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  async function cargarDatos() {
    try {
      const [volumenRes, gruposRes, frecuentesRes, oneRmRes, compRes] = await Promise.all([
        fetch(`${API_URL}/api/progreso/volumen`),
        fetch(`${API_URL}/api/progreso/grupos`),
        fetch(`${API_URL}/api/progreso/ejercicios-frecuentes`),
        fetch(`${API_URL}/api/metricas/1rm`),
        fetch(`${API_URL}/api/metricas/comparativa-semanal`)
      ]);

      const volumenData = await volumenRes.json();
      const gruposData = await gruposRes.json();
      const frecuentesData = await frecuentesRes.json();
      const oneRmDataRes = await oneRmRes.json();
      const compData = await compRes.json();

      setVolumenSemanal(volumenData.volumen_semanal || []);
      setPorGrupo(gruposData.por_grupo || {});
      setEjerciciosFrecuentes(frecuentesData.ejercicios || []);
      setOneRmData(oneRmDataRes.estimaciones || []);
      setComparativa(compData);

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
      const res = await fetch(`${API_URL}/api/progreso/ejercicio/${encodeURIComponent(nombre)}`);
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

  // Obtener el 1RM del ejercicio seleccionado
  const oneRmSeleccionado = oneRmData.find(
    rm => rm.ejercicio.toLowerCase() === ejercicioSeleccionado.toLowerCase()
  );

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gym-bg flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gym-purple" />
          <span className="ml-3 text-gray-400">Cargando tu progreso...</span>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gym-bg text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">
              <span className="bg-gradient-to-r from-gym-green to-teal-400 bg-clip-text text-transparent">
                Tu Progreso
              </span>
            </h1>
            <p className="text-gray-400">Visualiza tu evolución y métricas de fuerza</p>
          </div>

          {/* Comparativa semanal */}
          {comparativa && (
            <div className="bg-gradient-to-br from-gym-purple/10 to-gym-accent/10 rounded-xl border border-gym-purple/30 p-6 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gym-purple" />
                Esta Semana vs. Semana Anterior
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <ComparativaCard
                  label="Entrenamientos"
                  actual={comparativa.esta_semana?.entrenamientos || 0}
                  cambio={comparativa.cambio?.entrenamientos}
                />
                <ComparativaCard
                  label="Series Totales"
                  actual={comparativa.esta_semana?.series || 0}
                  cambio={comparativa.cambio?.series}
                />
                <ComparativaCard
                  label="Ejercicios"
                  actual={comparativa.esta_semana?.ejercicios || 0}
                  cambio={comparativa.cambio?.ejercicios}
                />
              </div>
            </div>
          )}

          {/* Métricas principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard
              icon={Calendar}
              label="Total Entrenamientos"
              value={totalEntrenamientos}
              color="purple"
            />
            <MetricCard
              icon={Activity}
              label="Total Series"
              value={totalSeries}
              color="blue"
            />
            <MetricCard
              icon={TrendingUp}
              label="Promedio/Semana"
              value={promedioSemana}
              color="green"
            />
            <MetricCard
              icon={Target}
              label="Grupos Trabajados"
              value={Object.keys(porGrupo).length}
              color="orange"
            />
          </div>

          {/* 1RM Estimados - Destacado */}
          {oneRmData.length > 0 && (
            <div className="bg-gym-dark/50 rounded-xl p-6 border border-white/10 mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Tus Marcas: 1RM Estimados
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {oneRmData.slice(0, 8).map((rm, i) => (
                  <div 
                    key={i}
                    className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg p-4 border border-yellow-500/20 hover:border-yellow-500/40 transition-all cursor-pointer"
                    onClick={() => setEjercicioSeleccionado(rm.ejercicio)}
                  >
                    <p className="text-sm text-gray-400 truncate mb-1">{rm.ejercicio}</p>
                    <p className="text-2xl font-bold text-yellow-400">{rm.rm_estimado}kg</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Basado en {rm.peso_usado}kg x {rm.repeticiones}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">
                * Calculado usando la fórmula de Brzycki: 1RM = peso × (36 / (37 - reps))
              </p>
            </div>
          )}

          {/* Gráfica de volumen semanal */}
          <div className="bg-gym-dark/50 rounded-xl p-6 border border-white/10 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-gym-green" />
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
                        className="w-full bg-gradient-to-t from-gym-green to-teal-400 rounded-t-md transition-all hover:from-gym-green/80 hover:to-teal-300 cursor-pointer"
                        style={{ height: `${Math.max(height, 5)}%`, minHeight: '8px' }}
                      />
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gym-dark text-xs px-2 py-1 rounded whitespace-nowrap border border-white/10">
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
          <div className="bg-gym-dark/50 rounded-xl p-6 border border-white/10 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-gym-purple" />
              Progreso por Ejercicio
            </h2>

            {/* Selector de ejercicio */}
            <div className="relative mb-6">
              <select
                value={ejercicioSeleccionado}
                onChange={(e) => setEjercicioSeleccionado(e.target.value)}
                className="w-full bg-gym-dark border border-white/20 rounded-lg px-4 py-3 text-white appearance-none cursor-pointer focus:outline-none focus:border-gym-purple"
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg p-4 text-center border border-yellow-500/20">
                    <div className="text-gray-400 text-sm">Máximo</div>
                    <div className="text-xl font-bold text-yellow-400">{maxPeso}kg</div>
                  </div>
                  <div className="bg-gym-dark rounded-lg p-4 text-center border border-white/10">
                    <div className="text-gray-400 text-sm">Último</div>
                    <div className="text-xl font-bold text-white">
                      {progresoEjercicio[progresoEjercicio.length - 1]?.peso}kg
                    </div>
                  </div>
                  <div className="bg-gym-dark rounded-lg p-4 text-center border border-white/10">
                    <div className="text-gray-400 text-sm">Progreso</div>
                    <div className={`text-xl font-bold ${progreso && progreso.diferencia >= 0 ? 'text-gym-green' : 'text-red-400'}`}>
                      {progreso ? `${progreso.diferencia >= 0 ? '+' : ''}${progreso.diferencia}kg` : '-'}
                    </div>
                  </div>
                  {oneRmSeleccionado && (
                    <div className="bg-gradient-to-br from-gym-purple/10 to-gym-accent/10 rounded-lg p-4 text-center border border-gym-purple/20">
                      <div className="text-gray-400 text-sm">1RM Est.</div>
                      <div className="text-xl font-bold text-gym-purple">{oneRmSeleccionado.rm_estimado}kg</div>
                    </div>
                  )}
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
                          className="w-full bg-gradient-to-t from-gym-purple to-gym-accent rounded-t-sm hover:opacity-80 transition-all cursor-pointer relative"
                          style={{ height: `${Math.max(height, 10)}%` }}
                        >
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gym-dark text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-white/10">
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
          <div className="bg-gym-dark/50 rounded-xl p-6 border border-white/10 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-gym-accent" />
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
                      <div className="h-2 bg-gym-dark rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-gym-purple to-gym-accent rounded-full transition-all"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Ejercicios más frecuentes */}
          <div className="bg-gym-dark/50 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Ejercicios Más Frecuentes
            </h2>

            <div className="space-y-3">
              {ejerciciosFrecuentes.slice(0, 10).map((ej, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-4 bg-gym-dark rounded-lg p-3 hover:bg-white/5 transition-colors cursor-pointer border border-white/5 hover:border-white/10"
                  onClick={() => setEjercicioSeleccionado(ej.nombre)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    i === 1 ? 'bg-gray-400/20 text-gray-300' :
                    i === 2 ? 'bg-orange-600/20 text-orange-400' :
                    'bg-white/5 text-gray-400'
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
                        <div className="font-bold text-gym-green">{ej.max_peso}kg</div>
                        <div className="text-xs text-gray-500">máx</div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Componentes auxiliares
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: any; 
  label: string; 
  value: number; 
  color: 'purple' | 'blue' | 'green' | 'orange';
}) {
  const colors = {
    purple: 'from-gym-purple to-purple-600',
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-gym-green to-teal-500',
    orange: 'from-orange-500 to-red-500',
  };

  return (
    <div className="bg-gym-dark/50 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function ComparativaCard({ 
  label, 
  actual, 
  cambio 
}: { 
  label: string; 
  actual: number; 
  cambio?: number;
}) {
  const isPositive = cambio && cambio > 0;
  const isNegative = cambio && cambio < 0;

  return (
    <div className="bg-gym-dark/50 rounded-lg p-4 text-center border border-white/10">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{actual}</p>
      {cambio !== undefined && (
        <div className={`flex items-center justify-center gap-1 mt-1 text-sm ${
          isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400'
        }`}>
          {isPositive && <ArrowUp className="w-3 h-3" />}
          {isNegative && <ArrowDown className="w-3 h-3" />}
          <span>{cambio > 0 ? '+' : ''}{cambio}%</span>
        </div>
      )}
    </div>
  );
}
