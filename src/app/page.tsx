'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import StatsCards from '@/components/StatsCards';
import WorkoutCard from '@/components/WorkoutCard';
import { fetchEntrenamientos, fetchEstadisticas } from '@/lib/api';
import { Entrenamiento } from '@/types';
import { ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [entrenamientos, setEntrenamientos] = useState<Entrenamiento[]>([]);
  const [estadisticas, setEstadisticas] = useState<any>(null);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Últimos 4 entrenamientos
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
            <span className="ml-3 text-gray-400">Cargando entrenamientos desde MongoDB...</span>
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
            <p className="text-gray-400 mt-2">Asegúrate de que el backend de Python esté corriendo en el puerto 8000</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Bienvenido a{' '}
            <span className="bg-gradient-to-r from-gym-purple to-gym-accent bg-clip-text text-transparent">
              Trener
            </span>
          </h1>
          <p className="text-gray-400 text-lg">
            Tu asistente personal de entrenamiento potenciado con IA
          </p>
        </div>

        {/* Stats */}
        {estadisticas && (
          <div className="mb-8">
            <StatsCards
              totalEntrenamientos={estadisticas.totalEntrenamientos}
              totalEjercicios={estadisticas.totalEjercicios}
              ejerciciosUnicos={estadisticas.ejerciciosUnicos}
              diasEntrenados={estadisticas.diasEntrenados}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Link
            href="/generar"
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gym-purple/20 to-gym-accent/20 border border-gym-purple/30 p-6 hover:border-gym-purple/50 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gym-purple">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-gym-accent transition-colors">
                  Generar Rutina con IA
                </h3>
                <p className="text-sm text-gray-400">
                  Crea una nueva rutina personalizada basada en tu historial
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gym-accent group-hover:translate-x-1 transition-all ml-auto" />
            </div>
          </Link>

          <Link
            href="/entrenamientos"
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gym-green/20 to-teal-500/20 border border-gym-green/30 p-6 hover:border-gym-green/50 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gym-green">
                <ArrowRight className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-gym-green transition-colors">
                  Ver Todos los Entrenamientos
                </h3>
                <p className="text-sm text-gray-400">
                  Explora y filtra tu historial completo
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
                  hombro: 'from-purple-500 to-pink-500',
                };
                return (
                  <div
                    key={tipo}
                    className="relative overflow-hidden rounded-xl bg-gym-dark/50 border border-white/10 p-4"
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
