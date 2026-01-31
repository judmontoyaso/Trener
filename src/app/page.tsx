'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import WorkoutCard from '@/components/WorkoutCard';
import { fetchEntrenamientos, fetchEstadisticas } from '@/lib/api';
import { Entrenamiento } from '@/types';
import { 
  ArrowRight, Sparkles, Loader2, Dumbbell, Target, 
  Flame, Calendar, TrendingUp, TrendingDown, Trophy,
  Zap, Brain
} from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Home() {
  const [entrenamientos, setEntrenamientos] = useState<Entrenamiento[]>([]);
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [resumenAI, setResumenAI] = useState<any>(null);
  const [comparativa, setComparativa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [entrs, stats] = await Promise.all([
          fetchEntrenamientos(),
          fetchEstadisticas(),
        ]);
        setEntrenamientos(entrs);
        setEstadisticas(stats);
        
        // Cargar resumen AI y comparativa en paralelo
        Promise.all([
          fetch(`${API_URL}/api/metricas/resumen-inteligente`).then(r => r.json()),
          fetch(`${API_URL}/api/metricas/comparativa-semanal`).then(r => r.json())
        ]).then(([resumen, comp]) => {
          setResumenAI(resumen);
          setComparativa(comp);
        }).catch(console.error);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const ultimosEntrenamientos = entrenamientos
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 4);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-gym-purple" />
            <span className="ml-3 text-gray-400">Cargando tu dashboard...</span>
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-red-300 text-lg">{error}</p>
            <p className="text-gray-400 mt-2">Verifica la conexión con el backend</p>
          </div>
        </main>
      </>
    );
  }

  const racha = resumenAI?.racha?.racha_actual || 0;
  const nivel = resumenAI?.nivel || { nivel: 1, titulo: 'Novato', xp: 0 };

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header con nivel */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Bienvenido a{' '}
              <span className="bg-gradient-to-r from-gym-purple to-gym-accent bg-clip-text text-transparent">
                Trener
              </span>
            </h1>
            <p className="text-gray-400">
              Tu asistente personal de entrenamiento potenciado con IA
            </p>
          </div>
          <Link href="/logros" className="flex items-center gap-3 bg-gym-dark/50 rounded-xl px-4 py-3 border border-white/10 hover:border-gym-purple/50 transition-all">
            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Nivel {nivel.nivel}</p>
              <p className="text-white font-semibold">{nivel.titulo}</p>
            </div>
          </Link>
        </div>

        {/* Resumen AI */}
        {resumenAI?.resumen_ai && (
          <div className="mb-8 bg-gradient-to-br from-gym-purple/10 to-gym-accent/10 rounded-xl border border-gym-purple/30 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-gym-purple to-gym-accent">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Tu Coach AI dice:</h3>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">{resumenAI.resumen_ai}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid con comparativas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            label="Entrenamientos"
            value={estadisticas?.totalEntrenamientos || 0}
            icon={Dumbbell}
            color="purple"
            trend={comparativa?.cambio?.entrenamientos}
          />
          <StatCard 
            label="Racha Actual"
            value={racha}
            suffix="días"
            icon={Flame}
            color="orange"
          />
          <StatCard 
            label="Esta Semana"
            value={resumenAI?.semana?.entrenamientos || 0}
            suffix="sesiones"
            icon={Calendar}
            color="green"
            trend={comparativa?.cambio?.entrenamientos}
          />
          <StatCard 
            label="Volumen"
            value={comparativa?.esta_semana?.series || 0}
            suffix="series"
            icon={Target}
            color="blue"
            trend={comparativa?.cambio?.series}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Link
            href="/generar"
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gym-purple/20 to-gym-accent/20 border border-gym-purple/30 p-6 hover:border-gym-purple/50 hover:shadow-lg hover:shadow-gym-purple/20 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-gym-purple to-gym-accent shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-gym-accent transition-colors">
                  Generar Rutina con IA
                </h3>
                <p className="text-sm text-gray-400">
                  Crea una rutina personalizada basada en tu historial
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gym-accent group-hover:translate-x-1 transition-all ml-auto" />
            </div>
          </Link>

          <Link
            href="/progreso"
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gym-green/20 to-teal-500/20 border border-gym-green/30 p-6 hover:border-gym-green/50 hover:shadow-lg hover:shadow-gym-green/20 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-gym-green to-teal-500 shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-gym-green transition-colors">
                  Ver Mi Progreso
                </h3>
                <p className="text-sm text-gray-400">
                  Gráficas, 1RM estimado y tendencias
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gym-green group-hover:translate-x-1 transition-all ml-auto" />
            </div>
          </Link>
        </div>

        {/* Distribución por tipo */}
        {estadisticas && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Distribución por Tipo</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(estadisticas.porTipo).map(([tipo, cantidad]) => {
                const colores: Record<string, string> = {
                  push: 'from-red-500 to-orange-500',
                  pull: 'from-blue-500 to-cyan-500',
                  pierna: 'from-green-500 to-teal-500',
                  legs: 'from-green-500 to-teal-500',
                  hombro: 'from-purple-500 to-pink-500',
                  full: 'from-yellow-500 to-orange-500',
                };
                return (
                  <div
                    key={tipo}
                    className="relative overflow-hidden rounded-xl bg-gym-dark/50 border border-white/10 p-4 hover:border-white/20 transition-all"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${colores[tipo] || 'from-gray-500 to-gray-600'} opacity-10`} />
                    <p className="text-3xl font-bold text-white relative">{cantidad as number}</p>
                    <p className="text-sm text-gray-400 capitalize relative">{tipo}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Workouts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Últimos Entrenamientos</h2>
            <Link
              href="/entrenamientos"
              className="text-sm text-gym-purple hover:text-gym-accent transition-colors flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {ultimosEntrenamientos.map((entrenamiento, index) => (
              <WorkoutCard key={entrenamiento.id || index} entrenamiento={entrenamiento} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

// Componente StatCard mejorado
function StatCard({ 
  label, 
  value, 
  suffix,
  icon: Icon, 
  color,
  trend 
}: { 
  label: string;
  value: number;
  suffix?: string;
  icon: any;
  color: 'purple' | 'orange' | 'green' | 'blue';
  trend?: number;
}) {
  const colors = {
    purple: 'from-gym-purple to-purple-600',
    orange: 'from-orange-500 to-red-500',
    green: 'from-gym-green to-emerald-600',
    blue: 'from-blue-500 to-cyan-500',
  };

  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : null;
  const trendColor = trend && trend > 0 ? 'text-green-400' : trend && trend < 0 ? 'text-red-400' : '';

  return (
    <div className="bg-gym-dark/50 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && TrendIcon && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-xs font-medium">{trend > 0 ? '+' : ''}{trend}%</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white">
        {value}
        {suffix && <span className="text-sm text-gray-400 ml-1">{suffix}</span>}
      </p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}
