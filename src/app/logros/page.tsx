"use client";

import { useState, useEffect } from "react";
import Navbar from '@/components/Navbar';
import { fetchPerfilGamificacion, fetchLogros } from '@/lib/api';
import type { Logro, PerfilGamificacion } from '@/types';
import { 
  Trophy, 
  Star, 
  Flame, 
  Target,
  Lock,
  CheckCircle2,
  Sparkles,
  Medal,
  Crown,
  Loader2
} from "lucide-react";

export default function LogrosPage() {
  const [perfil, setPerfil] = useState<PerfilGamificacion | null>(null);
  const [logros, setLogros] = useState<Logro[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewLogro, setShowNewLogro] = useState<{ nombre: string; descripcion: string; xp: number } | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      const [perfilData, logrosData] = await Promise.all([
        fetchPerfilGamificacion(),
        fetchLogros()
      ]);

      setPerfil(perfilData);
      setLogros(logrosData.logros || []);

      // Mostrar nuevos logros si los hay
      if (perfilData.nuevos_logros?.length > 0) {
        setShowNewLogro(perfilData.nuevos_logros[0]);
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  }

  const getNivelIcon = (nivel: number) => {
    if (nivel >= 10) return <Crown className="w-8 h-8 text-yellow-400" />;
    if (nivel >= 7) return <Medal className="w-8 h-8 text-purple-400" />;
    if (nivel >= 4) return <Star className="w-8 h-8 text-blue-400" />;
    return <Target className="w-8 h-8 text-emerald-400" />;
  };

  const getNivelColor = (nivel: number) => {
    if (nivel >= 10) return "from-yellow-600 to-yellow-400";
    if (nivel >= 7) return "from-purple-600 to-purple-400";
    if (nivel >= 4) return "from-blue-600 to-blue-400";
    return "from-emerald-600 to-emerald-400";
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gym-darker flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gym-purple" />
          <span className="ml-3 text-gray-400">Cargando logros...</span>
        </div>
      </>
    );
  }

  const xpProgreso = perfil ? ((perfil.xp / perfil.xp_siguiente_nivel) * 100) : 0;
  const logrosDesbloqueados = logros.filter(l => l.desbloqueado).length;

  return (
    <>
    <Navbar />
    <div className="min-h-screen bg-gym-darker text-white p-6">
      <div className="max-w-4xl mx-auto">
      {/* Modal de nuevo logro */}
      {showNewLogro && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-sm mx-4 text-center border border-yellow-500/50 shadow-2xl shadow-yellow-500/20">
            <Sparkles className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">¡Nuevo Logro!</h2>
            <div className="text-3xl mb-2">{showNewLogro.nombre}</div>
            <p className="text-gray-400 mb-4">{showNewLogro.descripcion}</p>
            <div className="text-emerald-400 font-bold text-xl mb-6">+{showNewLogro.xp} XP</div>
            <button
              onClick={() => setShowNewLogro(null)}
              className="bg-gradient-to-r from-yellow-600 to-yellow-500 px-8 py-3 rounded-lg font-bold hover:from-yellow-500 hover:to-yellow-400 transition-all"
            >
              ¡Genial!
            </button>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
        <Trophy className="text-yellow-400" />
        Tus Logros
      </h1>
      <p className="text-gray-400 mb-8">Desbloquea logros y sube de nivel</p>

      {/* Tarjeta de perfil */}
      {perfil && (
        <div className={`bg-gradient-to-br ${getNivelColor(perfil.nivel)} rounded-2xl p-1 mb-8`}>
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getNivelColor(perfil.nivel)} flex items-center justify-center`}>
                {getNivelIcon(perfil.nivel)}
              </div>
              <div>
                <div className="text-2xl font-bold">Nivel {perfil.nivel}</div>
                <div className={`text-lg bg-gradient-to-r ${getNivelColor(perfil.nivel)} bg-clip-text text-transparent font-semibold`}>
                  {perfil.titulo}
                </div>
              </div>
            </div>

            {/* Barra de XP */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Experiencia</span>
                <span className="font-medium">{perfil.xp} / {perfil.xp_siguiente_nivel} XP</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${getNivelColor(perfil.nivel)} rounded-full transition-all duration-1000`}
                  style={{ width: `${Math.min(xpProgreso, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 text-right">
                {perfil.xp_siguiente_nivel - perfil.xp} XP para siguiente nivel
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
          <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
          <div className="text-2xl font-bold">{logrosDesbloqueados}</div>
          <div className="text-xs text-gray-400">Desbloqueados</div>
        </div>
        
        <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
          <Target className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <div className="text-2xl font-bold">{logros.length - logrosDesbloqueados}</div>
          <div className="text-xs text-gray-400">Por desbloquear</div>
        </div>
        
        <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
          <Flame className="w-6 h-6 text-orange-400 mx-auto mb-2" />
          <div className="text-2xl font-bold">{perfil?.xp || 0}</div>
          <div className="text-xs text-gray-400">XP Total</div>
        </div>
      </div>

      {/* Lista de logros */}
      <h2 className="text-xl font-semibold mb-4">Todos los Logros</h2>
      
      <div className="space-y-3">
        {logros.map((logro) => (
          <div 
            key={logro.id}
            className={`rounded-xl p-4 border transition-all ${
              logro.desbloqueado 
                ? 'bg-gray-900 border-emerald-500/50' 
                : 'bg-gray-900/50 border-gray-800 opacity-60'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                logro.desbloqueado 
                  ? 'bg-emerald-500/20' 
                  : 'bg-gray-800'
              }`}>
                {logro.desbloqueado ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <Lock className="w-5 h-5 text-gray-600" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{logro.nombre.split(' ')[0]}</span>
                  <span className={`font-semibold ${logro.desbloqueado ? 'text-white' : 'text-gray-500'}`}>
                    {logro.nombre.split(' ').slice(1).join(' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-400">{logro.descripcion}</div>
              </div>
              
              <div className={`text-right ${logro.desbloqueado ? 'text-emerald-400' : 'text-gray-600'}`}>
                <div className="font-bold">+{logro.xp}</div>
                <div className="text-xs">XP</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Motivación */}
      <div className="mt-8 bg-gradient-to-r from-emerald-900/50 to-blue-900/50 rounded-xl p-6 border border-emerald-500/30 text-center">
        <Sparkles className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
        <p className="text-lg">
          {logrosDesbloqueados === 0 && "¡Empieza a entrenar para desbloquear logros!"}
          {logrosDesbloqueados > 0 && logrosDesbloqueados < 5 && "¡Buen comienzo! Sigue así 💪"}
          {logrosDesbloqueados >= 5 && logrosDesbloqueados < 10 && "¡Vas muy bien! Eres constante 🔥"}
          {logrosDesbloqueados >= 10 && "¡Eres una leyenda del gym! 🏆"}
        </p>
      </div>
      </div>
    </div>
    </>
  );
}
