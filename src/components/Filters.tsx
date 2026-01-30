'use client';

import { TIPOS_ENTRENAMIENTO, GRUPOS_MUSCULARES } from '@/types';
import { Filter, X } from 'lucide-react';
import clsx from 'clsx';

interface FiltersProps {
  tipoSeleccionado: string | null;
  grupoSeleccionado: string | null;
  onTipoChange: (tipo: string | null) => void;
  onGrupoChange: (grupo: string | null) => void;
}

export default function Filters({
  tipoSeleccionado,
  grupoSeleccionado,
  onTipoChange,
  onGrupoChange,
}: FiltersProps) {
  const hayFiltrosActivos = tipoSeleccionado || grupoSeleccionado;

  return (
    <div className="bg-gym-dark/50 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gym-purple" />
          <h3 className="font-semibold text-white">Filtros</h3>
        </div>
        {hayFiltrosActivos && (
          <button
            onClick={() => {
              onTipoChange(null);
              onGrupoChange(null);
            }}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            Limpiar
          </button>
        )}
      </div>

      {/* Filtro por tipo */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-2">Por tipo de entrenamiento</p>
        <div className="flex flex-wrap gap-2">
          {TIPOS_ENTRENAMIENTO.map((tipo) => (
            <button
              key={tipo.id}
              onClick={() => onTipoChange(tipoSeleccionado === tipo.id ? null : tipo.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                tipoSeleccionado === tipo.id
                  ? `bg-gradient-to-r ${tipo.color} text-white`
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              )}
            >
              {tipo.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por grupo muscular */}
      <div>
        <p className="text-sm text-gray-400 mb-2">Por grupo muscular</p>
        <div className="flex flex-wrap gap-2">
          {GRUPOS_MUSCULARES.map((grupo) => (
            <button
              key={grupo.id}
              onClick={() => onGrupoChange(grupoSeleccionado === grupo.id ? null : grupo.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1',
                grupoSeleccionado === grupo.id
                  ? `${grupo.color} text-white`
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              )}
            >
              <span>{grupo.icon}</span>
              <span>{grupo.nombre}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
