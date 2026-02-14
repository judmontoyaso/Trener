"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import LoadingScreen from "@/components/ui/LoadingScreen";
import {
  fetchVolumenSemanal,
  fetchProgresoGrupos,
  fetchEjerciciosFrecuentes,
  fetchOneRm,
  fetchComparativaSemanal,
  fetchProgresoEjercicio
} from "@/lib/api";
import type {
  ProgresoEjercicio,
  VolumenSemanal,
  EjercicioFrecuente,
  OneRmEstimacion,
  ComparativaSemanal
} from "@/types";
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

interface GrupoData {
  entrenamientos: number;
  series: number;
}

export default function ProgresoPage() {
  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState("");
  const [busquedaEjercicio, setBusquedaEjercicio] = useState("");
  const [progresoEjercicio, setProgresoEjercicio] = useState<ProgresoEjercicio[]>([]);
  const [volumenSemanal, setVolumenSemanal] = useState<VolumenSemanal[]>([]);
  const [porGrupo, setPorGrupo] = useState<Record<string, GrupoData>>({});
  const [ejerciciosFrecuentes, setEjerciciosFrecuentes] = useState<EjercicioFrecuente[]>([]);
  const [oneRmData, setOneRmData] = useState<OneRmEstimacion[]>([]);
  const [comparativa, setComparativa] = useState<ComparativaSemanal | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtrar ejercicios según búsqueda
  const ejerciciosFiltrados = ejerciciosFrecuentes.filter(ej =>
    ej.nombre.toLowerCase().includes(busquedaEjercicio.toLowerCase())
  );

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
      const [volumenData, gruposData, frecuentesData, oneRmDataRes, compData] = await Promise.all([
        fetchVolumenSemanal(),
        fetchProgresoGrupos(),
        fetchEjerciciosFrecuentes(),
        fetchOneRm(),
        fetchComparativaSemanal()
      ]);

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
      const data = await fetchProgresoEjercicio(nombre);
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
    return <LoadingScreen message="Cargando tu progreso..." />;
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

            {/* Buscador de ejercicio */}
            <div className="mb-3">
              <input
                type="text"
                value={busquedaEjercicio}
                onChange={(e) => setBusquedaEjercicio(e.target.value)}
                placeholder="Buscar ejercicio... (ej: press, curl, remo)"
                className="w-full bg-gym-dark border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gym-purple text-sm"
              />
            </div>

            {/* Selector de ejercicio */}
            <div className="relative mb-6">
              <select
                value={ejercicioSeleccionado}
                onChange={(e) => setEjercicioSeleccionado(e.target.value)}
                className="w-full bg-gym-dark border border-white/20 rounded-lg px-4 py-3 text-white appearance-none cursor-pointer focus:outline-none focus:border-gym-purple"
              >
                {ejerciciosFiltrados.map((ej, i) => (
                  <option key={i} value={ej.nombre}>
                    {ej.nombre} ({ej.veces}x) - Max: {ej.max_peso}kg
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <span className="text-xs text-gray-500 mt-1 block">
                {ejerciciosFiltrados.length} de {ejerciciosFrecuentes.length} ejercicios
              </span>
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

                {/* Gráfica de Línea de Fuerza */}
                {progresoEjercicio.length >= 2 && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Curva de Progresión
                    </h3>
                    <GraficaFuerza datos={progresoEjercicio} />
                  </div>
                )}
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

// Gráfica de línea SVG para progresión de fuerza
function GraficaFuerza({ datos }: { datos: ProgresoEjercicio[] }) {
  if (datos.length < 2) return null;

  const ultimos = datos.slice(-15); // Últimos 15 registros
  const pesos = ultimos.map(d => d.peso);
  const minPeso = Math.min(...pesos) * 0.9;
  const maxPeso = Math.max(...pesos) * 1.1;
  const rangoY = maxPeso - minPeso;

  const width = 100;
  const height = 50;
  const padding = 2;

  // Generar puntos para la línea
  const puntos = ultimos.map((d, i) => {
    const x = padding + (i / (ultimos.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.peso - minPeso) / rangoY) * (height - padding * 2);
    return { x, y, peso: d.peso, fecha: d.fecha };
  });

  // Crear path de la línea
  const linePath = puntos.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');

  // Crear path del área bajo la curva
  const areaPath = `${linePath} L ${puntos[puntos.length - 1].x} ${height - padding} L ${puntos[0].x} ${height - padding} Z`;

  // Calcular línea de tendencia (regresión lineal simple)
  const n = ultimos.length;
  const sumX = ultimos.reduce((acc, _, i) => acc + i, 0);
  const sumY = ultimos.reduce((acc, d) => acc + d.peso, 0);
  const sumXY = ultimos.reduce((acc, d, i) => acc + i * d.peso, 0);
  const sumX2 = ultimos.reduce((acc, _, i) => acc + i * i, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  const trendStart = intercept;
  const trendEnd = slope * (n - 1) + intercept;
  
  const trendY1 = height - padding - ((trendStart - minPeso) / rangoY) * (height - padding * 2);
  const trendY2 = height - padding - ((trendEnd - minPeso) / rangoY) * (height - padding * 2);

  const tendenciaPositiva = slope > 0;
  const cambioTotal = ((pesos[pesos.length - 1] - pesos[0]) / pesos[0] * 100).toFixed(1);

  return (
    <div className="space-y-2">
      {/* Info de tendencia */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">
          {ultimos[0].fecha} → {ultimos[ultimos.length - 1].fecha}
        </span>
        <span className={`font-medium ${tendenciaPositiva ? 'text-green-400' : 'text-red-400'}`}>
          {tendenciaPositiva ? '📈' : '📉'} {tendenciaPositiva ? '+' : ''}{cambioTotal}%
        </span>
      </div>

      {/* Gráfica SVG */}
      <div className="relative bg-gym-dark rounded-lg p-4 border border-white/5">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-32"
          preserveAspectRatio="none"
        >
          {/* Grid horizontal */}
          {[0.25, 0.5, 0.75].map(pct => (
            <line
              key={pct}
              x1={padding}
              y1={height * pct}
              x2={width - padding}
              y2={height * pct}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="2,2"
            />
          ))}

          {/* Área bajo la curva */}
          <path
            d={areaPath}
            fill="url(#areaGradient)"
            opacity="0.3"
          />

          {/* Línea de tendencia */}
          <line
            x1={padding}
            y1={trendY1}
            x2={width - padding}
            y2={trendY2}
            stroke={tendenciaPositiva ? '#22c55e' : '#ef4444'}
            strokeWidth="0.5"
            strokeDasharray="3,3"
            opacity="0.7"
          />

          {/* Línea principal */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Puntos */}
          {puntos.map((p, i) => (
            <g key={i} className="group">
              <circle
                cx={p.x}
                cy={p.y}
                r="1.5"
                fill="#a855f7"
                stroke="#1a1a2e"
                strokeWidth="0.5"
                className="transition-all hover:r-3"
              />
              {/* Tooltip */}
              <title>{p.peso}kg - {p.fecha}</title>
            </g>
          ))}

          {/* Gradientes */}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Etiquetas Y */}
        <div className="absolute left-0 top-4 bottom-4 flex flex-col justify-between text-[10px] text-gray-500 -ml-1">
          <span>{Math.round(maxPeso)}kg</span>
          <span>{Math.round((maxPeso + minPeso) / 2)}kg</span>
          <span>{Math.round(minPeso)}kg</span>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gym-dark/30 rounded p-2">
          <div className="text-[10px] text-gray-500">Inicio</div>
          <div className="text-sm font-medium text-white">{pesos[0]}kg</div>
        </div>
        <div className="bg-gym-dark/30 rounded p-2">
          <div className="text-[10px] text-gray-500">Actual</div>
          <div className="text-sm font-medium text-cyan-400">{pesos[pesos.length - 1]}kg</div>
        </div>
        <div className={`rounded p-2 ${tendenciaPositiva ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <div className="text-[10px] text-gray-500">Ganancia</div>
          <div className={`text-sm font-medium ${tendenciaPositiva ? 'text-green-400' : 'text-red-400'}`}>
            {tendenciaPositiva ? '+' : ''}{(pesos[pesos.length - 1] - pesos[0]).toFixed(1)}kg
          </div>
        </div>
      </div>
    </div>
  );
}
