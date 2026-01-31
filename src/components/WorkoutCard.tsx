'use client';

import { Entrenamiento, GRUPOS_MUSCULARES } from '@/types';
import { ChevronDown, ChevronUp, Weight, Repeat, Layers, MessageSquare, Clock } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

interface WorkoutCardProps {
  entrenamiento: Entrenamiento;
}

export default function WorkoutCard({ entrenamiento }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getGradient = (tipo: string) => {
    const gradients: Record<string, string> = {
      push: 'from-red-500/20 to-orange-500/20 border-red-500/30',
      pull: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
      pierna: 'from-green-500/20 to-teal-500/20 border-green-500/30',
      hombro: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    };
    return gradients[tipo] || 'from-gray-500/20 to-gray-600/20 border-gray-500/30';
  };

  const getAccentColor = (tipo: string) => {
    const colors: Record<string, string> = {
      push: 'text-red-400',
      pull: 'text-blue-400',
      pierna: 'text-green-400',
      hombro: 'text-purple-400',
    };
    return colors[tipo] || 'text-gray-400';
  };

  const formatPeso = (peso: number | number[] | string): string => {
    if (typeof peso === 'string') return peso;
    if (Array.isArray(peso)) {
      const min = Math.min(...peso);
      const max = Math.max(...peso);
      return min === max ? `${min} kg` : `${min}-${max} kg`;
    }
    return `${peso} kg`;
  };

  const formatReps = (reps: number | number[]): string => {
    if (Array.isArray(reps)) {
      const min = Math.min(...reps);
      const max = Math.max(...reps);
      return min === max ? `${min}` : `${min}-${max}`;
    }
    return `${reps}`;
  };

  // Parsear fecha sin problema de zona horaria
  // "2026-01-30" -> se interpreta como fecha local, no UTC
  const parseFechaLocal = (fechaStr: string) => {
    const [year, month, day] = fechaStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const fechaFormateada = parseFechaLocal(entrenamiento.fecha).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div
      className={clsx(
        'workout-card rounded-xl border bg-gradient-to-br p-4',
        getGradient(entrenamiento.tipo)
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={clsx('text-xs font-semibold uppercase tracking-wider', getAccentColor(entrenamiento.tipo))}>
            {entrenamiento.tipo}
          </span>
          <h3 className="text-lg font-bold text-white mt-1">{entrenamiento.nombre}</h3>
          <p className="text-sm text-gray-400">{fechaFormateada}</p>
        </div>
        <div className="flex flex-wrap gap-1 max-w-[120px] justify-end">
          {entrenamiento.grupos_musculares.slice(0, 3).map((grupo) => {
            const grupoInfo = GRUPOS_MUSCULARES.find(g => g.id === grupo);
            return (
              <span
                key={grupo}
                className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300"
              >
                {grupoInfo?.icon} {grupoInfo?.nombre || grupo}
              </span>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-3 text-sm">
        <div className="flex items-center gap-1 text-gray-400">
          <Layers className="w-4 h-4" />
          <span>{entrenamiento.ejercicios.length} ejercicios</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <Repeat className="w-4 h-4" />
          <span>{entrenamiento.ejercicios.reduce((acc, e) => acc + e.series, 0)} series</span>
        </div>
      </div>

      {/* Toggle exercises */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        {expanded ? (
          <>
            <span>Ocultar ejercicios</span>
            <ChevronUp className="w-4 h-4" />
          </>
        ) : (
          <>
            <span>Ver ejercicios</span>
            <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Exercises list */}
      {expanded && (
        <div className="mt-3 space-y-2 animate-fadeIn">
          {entrenamiento.ejercicios.map((ejercicio, index) => (
            <div
              key={index}
              className="bg-black/20 rounded-lg p-3 border border-white/5"
            >
              <p className="font-medium text-white text-sm mb-2">{ejercicio.nombre}</p>
              <div className="flex gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {ejercicio.series} series
                </span>
                <span className="flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  {formatReps(ejercicio.repeticiones)} reps
                </span>
                <span className="flex items-center gap-1">
                  <Weight className="w-3 h-3" />
                  {formatPeso(ejercicio.peso_kg)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notas */}
      {entrenamiento.notas && (
        <div className="mt-3 p-3 bg-black/20 rounded-lg border border-white/5">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <MessageSquare className="w-3 h-3" />
            <span>Notas</span>
          </div>
          <p className="text-sm text-gray-300">{entrenamiento.notas}</p>
        </div>
      )}

      {/* Duración */}
      {entrenamiento.duracion_aprox_min && (
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>~{entrenamiento.duracion_aprox_min} min</span>
        </div>
      )}
    </div>
  );
}
