'use client';

import Navbar from '@/components/Navbar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchEntrenamientoActivo as apiFetchEntrenamientoActivo,
  actualizarSerie as apiActualizarSerie,
  completarEjercicioActivo as apiCompletarEjercicio,
  finalizarEntrenamientoActivo as apiFinalizarEntrenamiento,
  cancelarEntrenamientoActivo as apiCancelarEntrenamiento,
} from '@/lib/api';
import {
  Play,
  Pause,
  Check,
  X,
  Plus,
  Minus,
  Trophy,
  Timer,
  Dumbbell,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';

interface SerieRealizada {
  numero: number;
  repeticiones: number;
  peso_kg: number;
  completada: boolean;
}

interface EjercicioActivo {
  nombre: string;
  series_planificadas: number;
  repeticiones_objetivo: number | number[];
  peso_sugerido: number | string;
  series_realizadas: SerieRealizada[];
  completado: boolean;
  notas?: string;
}

interface EntrenamientoActivo {
  _id: string;
  nombre: string;
  tipo: string;
  fecha: string;
  grupos_musculares: string[];
  ejercicios: EjercicioActivo[];
  inicio: string;
  completado: boolean;
}

export default function EntrenamientoActivoPage() {
  const router = useRouter();
  const [entrenamiento, setEntrenamiento] = useState<EntrenamientoActivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [ejercicioActual, setEjercicioActual] = useState(0);
  const [expandido, setExpandido] = useState<number | null>(0);
  
  // Estado para la serie actual
  const [pesoActual, setPesoActual] = useState(0);
  const [repsActuales, setRepsActuales] = useState(10);
  const [guardandoSerie, setGuardandoSerie] = useState(false);
  
  // Timer
  const [tiempoInicio, setTiempoInicio] = useState<Date | null>(null);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState('00:00:00');
  
  // Finalización
  const [finalizando, setFinalizando] = useState(false);
  const [enviarMatrix, setEnviarMatrix] = useState(true);
  const [resumenFinal, setResumenFinal] = useState<string | null>(null);

  useEffect(() => {
    cargarEntrenamiento();
  }, []);

  useEffect(() => {
    if (tiempoInicio) {
      const interval = setInterval(() => {
        const diff = Date.now() - tiempoInicio.getTime();
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTiempoTranscurrido(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [tiempoInicio]);

  const cargarEntrenamiento = async () => {
    try {
      const data = await apiFetchEntrenamientoActivo();
      
      console.log('Entrenamiento cargado:', data);
      
      if (data.activo && data.entrenamiento) {
        setEntrenamiento(data.entrenamiento);
        setTiempoInicio(new Date(data.entrenamiento.inicio));
        
        // Establecer peso inicial sugerido
        const ejercicio = data.entrenamiento.ejercicios[0];
        if (ejercicio) {
          const pesoSugerido = ejercicio.peso_sugerido;
          console.log('Peso sugerido ejercicio 0:', pesoSugerido);
          
          // El peso puede ser número, string numérico, o "ajustar"
          let peso = 20; // default
          if (typeof pesoSugerido === 'number') {
            peso = pesoSugerido;
          } else if (typeof pesoSugerido === 'string' && pesoSugerido !== 'ajustar') {
            peso = parseFloat(pesoSugerido) || 20;
          }
          setPesoActual(peso);
          
          const reps = typeof ejercicio.repeticiones_objetivo === 'number'
            ? ejercicio.repeticiones_objetivo
            : Array.isArray(ejercicio.repeticiones_objetivo) 
              ? ejercicio.repeticiones_objetivo[0] || 10
              : 10;
          setRepsActuales(reps);
        }
      } else {
        // No hay entrenamiento activo
        router.push('/generar');
      }
    } catch (error) {
      console.error('Error cargando entrenamiento:', error);
    } finally {
      setLoading(false);
    }
  };

  const cambiarEjercicio = (index: number) => {
    setEjercicioActual(index);
    setExpandido(index);
    
    if (entrenamiento) {
      const ejercicio = entrenamiento.ejercicios[index];
      const pesoSugerido = ejercicio.peso_sugerido;
      
      let peso = 20;
      if (typeof pesoSugerido === 'number') {
        peso = pesoSugerido;
      } else if (typeof pesoSugerido === 'string' && pesoSugerido !== 'ajustar') {
        peso = parseFloat(pesoSugerido) || 20;
      }
      setPesoActual(peso);
      
      const reps = typeof ejercicio.repeticiones_objetivo === 'number'
        ? ejercicio.repeticiones_objetivo
        : Array.isArray(ejercicio.repeticiones_objetivo)
          ? ejercicio.repeticiones_objetivo[0] || 10
          : 10;
      setRepsActuales(reps);
    }
  };

  const guardarSerie = async () => {
    if (!entrenamiento) return;
    
    setGuardandoSerie(true);
    try {
      const ejercicio = entrenamiento.ejercicios[ejercicioActual];
      const numeroSerie = ejercicio.series_realizadas.length + 1;
      
      const result = await apiActualizarSerie({
        ejercicio_index: ejercicioActual,
        serie: {
          numero: numeroSerie,
          repeticiones: repsActuales,
          peso_kg: pesoActual,
          completada: true
        }
      });
      
      if (result.success) {
        // Actualizar estado local
        const nuevoEntrenamiento = { ...entrenamiento };
        nuevoEntrenamiento.ejercicios[ejercicioActual].series_realizadas.push({
          numero: numeroSerie,
          repeticiones: repsActuales,
          peso_kg: pesoActual,
          completada: true
        });
        
        // Marcar como completado si terminó todas las series
        if (nuevoEntrenamiento.ejercicios[ejercicioActual].series_realizadas.length >= 
            nuevoEntrenamiento.ejercicios[ejercicioActual].series_planificadas) {
          nuevoEntrenamiento.ejercicios[ejercicioActual].completado = true;
          
          // Pasar al siguiente ejercicio si hay
          if (ejercicioActual < nuevoEntrenamiento.ejercicios.length - 1) {
            cambiarEjercicio(ejercicioActual + 1);
          }
        }
        
        setEntrenamiento(nuevoEntrenamiento);
      }
    } catch (error) {
      console.error('Error guardando serie:', error);
    } finally {
      setGuardandoSerie(false);
    }
  };

  const completarEjercicio = async (index: number) => {
    if (!entrenamiento) return;
    
    try {
      await apiCompletarEjercicio(index);
      
      const nuevoEntrenamiento = { ...entrenamiento };
      nuevoEntrenamiento.ejercicios[index].completado = true;
      setEntrenamiento(nuevoEntrenamiento);
      
      if (index < nuevoEntrenamiento.ejercicios.length - 1) {
        cambiarEjercicio(index + 1);
      }
    } catch (error) {
      console.error('Error completando ejercicio:', error);
    }
  };

  const finalizarEntrenamiento = async () => {
    setFinalizando(true);
    try {
      const data = await apiFinalizarEntrenamiento(enviarMatrix);
      
      if (data.success) {
        setResumenFinal(data.resumen);
      }
    } catch (error) {
      console.error('Error finalizando:', error);
    } finally {
      setFinalizando(false);
    }
  };

  const cancelarEntrenamiento = async () => {
    if (!confirm('¿Seguro que deseas cancelar el entrenamiento? Se perderá el progreso.')) return;
    
    try {
      await apiCancelarEntrenamiento();
      router.push('/');
    } catch (error) {
      console.error('Error cancelando:', error);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-gym-purple" />
        </main>
      </>
    );
  }

  if (resumenFinal) {
    return (
      <>
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-br from-gym-green/20 to-green-500/10 rounded-2xl border border-gym-green/30 p-8 text-center">
            <Trophy className="w-20 h-20 text-gym-green mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">¡Entrenamiento Completado!</h1>
            <p className="text-gray-400 mb-6">Has terminado tu sesión de hoy</p>
            
            <div className="bg-black/30 rounded-xl p-4 text-left mb-6">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono">
                {resumenFinal}
              </pre>
            </div>
            
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-gym-purple hover:bg-gym-purple/80 rounded-xl font-semibold text-white transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </main>
      </>
    );
  }

  if (!entrenamiento) {
    return (
      <>
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-gray-400">No hay entrenamiento activo</p>
          <button
            onClick={() => router.push('/generar')}
            className="mt-4 px-6 py-3 bg-gym-purple rounded-xl text-white"
          >
            Generar rutina
          </button>
        </main>
      </>
    );
  }

  const ejercicioSeleccionado = entrenamiento.ejercicios[ejercicioActual];
  const seriesCompletadas = ejercicioSeleccionado.series_realizadas.length;
  const seriesTotal = ejercicioSeleccionado.series_planificadas;
  const ejerciciosCompletados = entrenamiento.ejercicios.filter(e => e.completado).length;
  const todosCompletados = ejerciciosCompletados === entrenamiento.ejercicios.length;

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header con timer */}
        <div className="bg-gradient-to-r from-gym-purple/20 to-gym-accent/20 rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-white">{entrenamiento.nombre}</h1>
              <p className="text-gray-400">{entrenamiento.grupos_musculares.join(' • ')}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-gym-green">
                <Timer className="w-5 h-5" />
                <span className="text-2xl font-mono font-bold">{tiempoTranscurrido}</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {ejerciciosCompletados}/{entrenamiento.ejercicios.length} ejercicios
              </p>
            </div>
          </div>
          
          {/* Barra de progreso */}
          <div className="mt-4 bg-black/30 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-gym-purple to-gym-green h-full transition-all duration-300"
              style={{ width: `${(ejerciciosCompletados / entrenamiento.ejercicios.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Lista de ejercicios */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Ejercicios
            </h3>
            {entrenamiento.ejercicios.map((ej, index) => (
              <button
                key={index}
                onClick={() => cambiarEjercicio(index)}
                className={clsx(
                  'w-full p-4 rounded-xl border text-left transition-all',
                  ejercicioActual === index
                    ? 'bg-gym-purple/20 border-gym-purple'
                    : ej.completado
                    ? 'bg-gym-green/10 border-gym-green/30'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {ej.completado ? (
                      <Check className="w-5 h-5 text-gym-green" />
                    ) : (
                      <Dumbbell className="w-5 h-5 text-gray-400" />
                    )}
                    <span className={clsx(
                      'font-medium',
                      ej.completado ? 'text-gym-green' : 'text-white'
                    )}>
                      {ej.nombre}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    {ej.series_realizadas.length}/{ej.series_planificadas}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Panel de ejercicio activo */}
          <div className="lg:col-span-2">
            <div className="bg-gym-dark/50 rounded-2xl border border-white/10 p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">{ejercicioSeleccionado.nombre}</h2>
                  <p className="text-gray-400">
                    Serie {seriesCompletadas + 1} de {seriesTotal}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Objetivo</p>
                  <p className="text-lg text-gym-purple font-semibold">
                    {typeof ejercicioSeleccionado.repeticiones_objetivo === 'number'
                      ? `${ejercicioSeleccionado.repeticiones_objetivo} reps`
                      : `${ejercicioSeleccionado.repeticiones_objetivo.join('-')} reps`}
                  </p>
                </div>
              </div>

              {/* Controles de peso y repeticiones */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Peso */}
                <div className="bg-black/30 rounded-xl p-4">
                  <label className="text-sm text-gray-400 block mb-2">Peso (kg)</label>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setPesoActual(Math.max(0, pesoActual - 2.5))}
                      className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                    >
                      <Minus className="w-5 h-5 text-white" />
                    </button>
                    <input
                      type="number"
                      value={pesoActual}
                      onChange={(e) => setPesoActual(Number(e.target.value))}
                      className="w-24 text-center text-3xl font-bold text-white bg-transparent border-none focus:outline-none"
                    />
                    <button
                      onClick={() => setPesoActual(pesoActual + 2.5)}
                      className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                    >
                      <Plus className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                {/* Repeticiones */}
                <div className="bg-black/30 rounded-xl p-4">
                  <label className="text-sm text-gray-400 block mb-2">Repeticiones</label>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setRepsActuales(Math.max(1, repsActuales - 1))}
                      className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                    >
                      <Minus className="w-5 h-5 text-white" />
                    </button>
                    <input
                      type="number"
                      value={repsActuales}
                      onChange={(e) => setRepsActuales(Number(e.target.value))}
                      className="w-24 text-center text-3xl font-bold text-white bg-transparent border-none focus:outline-none"
                    />
                    <button
                      onClick={() => setRepsActuales(repsActuales + 1)}
                      className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                    >
                      <Plus className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Botón guardar serie */}
              {!ejercicioSeleccionado.completado && (
                <button
                  onClick={guardarSerie}
                  disabled={guardandoSerie}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-gym-purple to-gym-accent font-semibold text-white hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {guardandoSerie ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  Completar Serie {seriesCompletadas + 1}
                </button>
              )}

              {/* Series completadas */}
              {ejercicioSeleccionado.series_realizadas.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Series completadas
                  </h4>
                  <div className="space-y-2">
                    {ejercicioSeleccionado.series_realizadas.map((serie, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center bg-gym-green/10 border border-gym-green/20 rounded-lg px-4 py-3"
                      >
                        <span className="text-gym-green font-medium">Serie {serie.numero}</span>
                        <span className="text-white">
                          {serie.repeticiones} reps @ {serie.peso_kg} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón saltar ejercicio */}
              {!ejercicioSeleccionado.completado && (
                <button
                  onClick={() => completarEjercicio(ejercicioActual)}
                  className="w-full mt-4 py-3 rounded-xl border border-white/20 text-gray-400 hover:text-white hover:border-white/40 transition-all"
                >
                  Saltar ejercicio
                </button>
              )}
            </div>

            {/* Botones de finalizar/cancelar */}
            <div className="mt-6 flex gap-4">
              <button
                onClick={cancelarEntrenamiento}
                className="flex-1 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Cancelar
              </button>
              
              <button
                onClick={finalizarEntrenamiento}
                disabled={finalizando}
                className={clsx(
                  'flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
                  todosCompletados
                    ? 'bg-gradient-to-r from-gym-green to-green-500 text-white hover:opacity-90'
                    : 'bg-white/10 text-white hover:bg-white/20'
                )}
              >
                {finalizando ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trophy className="w-5 h-5" />
                )}
                Finalizar
              </button>
            </div>

            {/* Opción de Matrix */}
            <div className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                id="matrix"
                checked={enviarMatrix}
                onChange={(e) => setEnviarMatrix(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-black/30 text-gym-purple focus:ring-gym-purple"
              />
              <label htmlFor="matrix" className="text-sm text-gray-400 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Enviar resumen a Matrix al finalizar
              </label>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
