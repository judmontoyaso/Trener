'use client';

import Navbar from '@/components/Navbar';
import { TIPOS_ENTRENAMIENTO, GRUPOS_MUSCULARES, Entrenamiento } from '@/types';
import { Sparkles, Loader2, Copy, Check, Download } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import WorkoutCard from '@/components/WorkoutCard';

interface GenerarClientProps {
  entrenamientosRecientes: Entrenamiento[];
}

export default function GenerarClient({ entrenamientosRecientes }: GenerarClientProps) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('push');
  const [gruposSeleccionados, setGruposSeleccionados] = useState<string[]>([]);
  const [objetivo, setObjetivo] = useState<string>('hipertrofia');
  const [duracion, setDuracion] = useState<number>(60);
  const [nivel, setNivel] = useState<string>('intermedio');
  const [notas, setNotas] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [rutinaGenerada, setRutinaGenerada] = useState<Entrenamiento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const toggleGrupo = (grupo: string) => {
    setGruposSeleccionados((prev) =>
      prev.includes(grupo) ? prev.filter((g) => g !== grupo) : [...prev, grupo]
    );
  };

  const generarRutina = async () => {
    setLoading(true);
    setError(null);
    setRutinaGenerada(null);

    try {
      const response = await fetch('/api/generar-rutina', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo: tipoSeleccionado,
          grupos_musculares: gruposSeleccionados.length > 0 ? gruposSeleccionados : undefined,
          objetivo,
          duracion_minutos: duracion,
          nivel,
          notas,
          entrenamientos_recientes: entrenamientosRecientes.slice(0, 5),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al generar la rutina');
      }

      const data = await response.json();
      setRutinaGenerada(data.rutina);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const copiarRutina = async () => {
    if (!rutinaGenerada) return;
    
    const texto = formatRutinaTexto(rutinaGenerada);
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const formatRutinaTexto = (rutina: Entrenamiento): string => {
    let texto = `${rutina.nombre}\n`;
    texto += `Fecha: ${rutina.fecha}\n`;
    texto += `Grupos musculares: ${rutina.grupos_musculares.join(', ')}\n\n`;
    texto += 'Ejercicios:\n';
    rutina.ejercicios.forEach((ej, i) => {
      const peso = typeof ej.peso_kg === 'string' ? ej.peso_kg : `${ej.peso_kg} kg`;
      texto += `${i + 1}. ${ej.nombre} - ${ej.series}x${ej.repeticiones} @ ${peso}\n`;
    });
    return texto;
  };

  const guardarRutina = async () => {
    if (!rutinaGenerada) return;
    
    try {
      const response = await fetch('/api/entrenamientos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rutinaGenerada),
      });

      if (!response.ok) {
        throw new Error('Error al guardar la rutina');
      }

      alert('¡Rutina guardada exitosamente!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-gym-purple" />
            Generar Rutina con IA
          </h1>
          <p className="text-gray-400">
            Crea una rutina personalizada basada en tu historial y preferencias
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Formulario */}
          <div className="space-y-6">
            {/* Tipo de entrenamiento */}
            <div className="bg-gym-dark/50 rounded-xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Tipo de Entrenamiento</h3>
              <div className="grid grid-cols-2 gap-3">
                {TIPOS_ENTRENAMIENTO.map((tipo) => (
                  <button
                    key={tipo.id}
                    onClick={() => setTipoSeleccionado(tipo.id)}
                    className={clsx(
                      'p-4 rounded-xl border transition-all text-left',
                      tipoSeleccionado === tipo.id
                        ? `bg-gradient-to-br ${tipo.color} border-white/30`
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    )}
                  >
                    <p className="font-semibold text-white">{tipo.nombre}</p>
                    <p className="text-sm text-gray-300">{tipo.descripcion}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Grupos musculares adicionales */}
            <div className="bg-gym-dark/50 rounded-xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Grupos Musculares (opcional)
              </h3>
              <div className="flex flex-wrap gap-2">
                {GRUPOS_MUSCULARES.map((grupo) => (
                  <button
                    key={grupo.id}
                    onClick={() => toggleGrupo(grupo.id)}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                      gruposSeleccionados.includes(grupo.id)
                        ? `${grupo.color} text-white`
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    )}
                  >
                    <span>{grupo.icon}</span>
                    <span>{grupo.nombre}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Configuración */}
            <div className="bg-gym-dark/50 rounded-xl border border-white/10 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Configuración</h3>

              {/* Objetivo */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Objetivo</label>
                <select
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:outline-none focus:border-gym-purple"
                >
                  <option value="hipertrofia">Hipertrofia (ganar músculo)</option>
                  <option value="fuerza">Fuerza</option>
                  <option value="resistencia">Resistencia</option>
                  <option value="definicion">Definición</option>
                </select>
              </div>

              {/* Nivel */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Nivel</label>
                <select
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value)}
                  className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:outline-none focus:border-gym-purple"
                >
                  <option value="principiante">Principiante</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="avanzado">Avanzado</option>
                </select>
              </div>

              {/* Duración */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Duración: {duracion} minutos
                </label>
                <input
                  type="range"
                  min="30"
                  max="120"
                  step="15"
                  value={duracion}
                  onChange={(e) => setDuracion(Number(e.target.value))}
                  className="w-full accent-gym-purple"
                />
              </div>

              {/* Notas adicionales */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Notas adicionales (opcional)
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej: Quiero enfocmarne en la parte superior del pecho, evitar ejercicios con barra..."
                  className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gym-purple resize-none h-24"
                />
              </div>
            </div>

            {/* Botón generar */}
            <button
              onClick={generarRutina}
              disabled={loading}
              className={clsx(
                'w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2',
                loading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-gym-purple to-gym-accent hover:opacity-90'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generando rutina...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generar Rutina
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Resultado */}
          <div>
            <div className="bg-gym-dark/50 rounded-xl border border-white/10 p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-white mb-4">Rutina Generada</h3>

              {rutinaGenerada ? (
                <div className="space-y-4">
                  <WorkoutCard entrenamiento={rutinaGenerada} />
                  
                  <div className="flex gap-3">
                    <button
                      onClick={copiarRutina}
                      className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-2 text-white"
                    >
                      {copiado ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar
                        </>
                      )}
                    </button>
                    <button
                      onClick={guardarRutina}
                      className="flex-1 py-3 rounded-lg bg-gym-green hover:bg-gym-green/80 transition-colors flex items-center justify-center gap-2 text-white"
                    >
                      <Download className="w-4 h-4" />
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">
                    Configura los parámetros y genera tu rutina personalizada
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
