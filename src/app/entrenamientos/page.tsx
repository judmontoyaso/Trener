'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import WorkoutCard from '@/components/WorkoutCard';
import Filters from '@/components/Filters';
import LoadingScreen from '@/components/ui/LoadingScreen';
import ErrorScreen from '@/components/ui/ErrorScreen';
import { fetchEntrenamientos } from '@/lib/api';
import type { Entrenamiento } from '@/types';
import { Search } from 'lucide-react';

export default function EntrenamientosPage() {
  const [entrenamientos, setEntrenamientos] = useState<Entrenamiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string | null>(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchEntrenamientos();
        setEntrenamientos(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const entrenamientosFiltrados = entrenamientos
    .filter((e) => !tipoSeleccionado || e.tipo === tipoSeleccionado)
    .filter((e) => !grupoSeleccionado || e.grupos_musculares.some((g) => g.toLowerCase() === grupoSeleccionado.toLowerCase()))
    .filter((e) => {
      if (!busqueda.trim()) return true;
      const termino = busqueda.toLowerCase();
      return (
        e.nombre.toLowerCase().includes(termino) ||
        e.ejercicios.some((ej) => ej.nombre.toLowerCase().includes(termino))
      );
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  if (loading) {
    return <LoadingScreen message="Cargando entrenamientos..." />;
  }

  if (error) {
    return <ErrorScreen message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Entrenamientos</h1>
          <p className="text-gray-400">
            Explora y filtra tu historial de {entrenamientos.length} entrenamientos
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o ejercicio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gym-dark/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gym-purple transition-colors"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <Filters
            tipoSeleccionado={tipoSeleccionado}
            grupoSeleccionado={grupoSeleccionado}
            onTipoChange={setTipoSeleccionado}
            onGrupoChange={setGrupoSeleccionado}
          />
        </div>

        {/* Results count */}
        <div className="mb-4">
          <p className="text-sm text-gray-400">
            Mostrando{' '}
            <span className="text-white font-semibold">{entrenamientosFiltrados.length}</span> de{' '}
            <span className="text-white font-semibold">{entrenamientos.length}</span> entrenamientos
          </p>
        </div>

        {/* Workouts Grid */}
        {entrenamientosFiltrados.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entrenamientosFiltrados.map((entrenamiento, index) => (
              <WorkoutCard key={entrenamiento.id || index} entrenamiento={entrenamiento} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No se encontraron entrenamientos</p>
            <p className="text-gray-500 text-sm mt-2">Intenta ajustar los filtros o la búsqueda</p>
          </div>
        )}
      </main>
    </>
  );
}
