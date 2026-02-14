// Tipos para los entrenamientos
export interface Ejercicio {
  nombre: string;
  series: number;
  repeticiones: number | number[];
  peso_kg: number | number[] | string;
  completado?: boolean;
  peso_realizado?: number[];
}

export interface Entrenamiento {
  _id?: {
    $oid: string;
  } | string;
  id: string;
  nombre: string;
  tipo: 'push' | 'pull' | 'pierna' | 'hombro' | 'core' | string;
  fecha: string;
  grupos_musculares: string[];
  ejercicios: Ejercicio[];
  notas?: string;
  duracion_aprox_min?: number;
}

export interface EntrenamientoActivo extends Entrenamiento {
  iniciado_en: string;
  estado: 'en_progreso' | 'completado' | 'cancelado';
  ejercicios_completados: EjercicioRealizado[];
}

export interface EjercicioRealizado {
  nombre: string;
  series_realizadas: SerieRealizada[];
}

export interface SerieRealizada {
  numero: number;
  peso_kg: number;
  repeticiones: number;
  completada: boolean;
}

export interface Equipamiento {
  id: string;
  nombre: string;
  tipo: 'maquina' | 'libre' | 'cable' | 'barra' | 'mancuerna' | 'otro';
  ejercicios_posibles: string[];
}

// ---- Estadísticas ----

export interface Estadisticas {
  totalEntrenamientos: number;
  totalEjercicios: number;
  ejerciciosUnicos: number;
  diasEntrenados: number;
  porTipo: Record<string, number>;
  porGrupo: Record<string, number>;
}

// ---- Resumen AI ----

export interface NivelUsuario {
  nivel: number;
  titulo: string;
  xp: number;
}

export interface RachaInfo {
  racha_actual: number;
  mejor_racha: number;
}

export interface ResumenSemana {
  entrenamientos: number;
  grupos_trabajados: string[];
  total_series: number;
  dias_restantes: number;
}

export interface ResumenAI {
  resumen_ai: string;
  stats?: Estadisticas;
  racha?: RachaInfo;
  semana?: ResumenSemana;
  comparativa?: ComparativaSemanal;
  nivel?: NivelUsuario;
  error?: string;
}

// ---- Comparativa Semanal ----

export interface DatosSemana {
  entrenamientos: number;
  series: number;
  ejercicios: number;
  volumen: number;
}

export interface ComparativaSemanal {
  esta_semana: DatosSemana;
  semana_pasada: DatosSemana;
  cambio: {
    entrenamientos: number;
    series: number;
    ejercicios: number;
    volumen: number;
  };
}

// ---- Progreso ----

export interface ProgresoEjercicio {
  fecha: string;
  peso: number;
  series: number;
  repeticiones: number | number[];
}

export interface VolumenSemanal {
  semana: string;
  series: number;
  ejercicios: number;
  entrenamientos: number;
}

export interface EjercicioFrecuente {
  nombre: string;
  veces: number;
  ultimo_peso: number | null;
  max_peso: number;
  promedio_peso?: number;
  primera_fecha?: string;
  ultima_fecha?: string;
}

export interface OneRmEstimacion {
  ejercicio: string;
  peso_usado: number;
  repeticiones: number;
  rm_estimado: number;
  fecha: string;
}

// ---- Gamificación ----

export interface Logro {
  id: string;
  nombre: string;
  descripcion: string;
  xp: number;
  desbloqueado: boolean;
}

export interface PerfilGamificacion {
  nivel: number;
  titulo: string;
  xp: number;
  xp_siguiente_nivel: number;
  logros_desbloqueados: string[];
  total_logros: number;
  nuevos_logros: Array<{ nombre: string; descripcion: string; xp: number }>;
}

// ---- Chat ----

export interface ChatResponse {
  respuesta: string;
  tipo: 'chat' | 'chat_mcp' | 'rutina_generada' | 'error';
  rutina?: Entrenamiento;
  tools_usados?: string[];
  contexto_actualizado?: Array<{ role: string; content: string }>;
}

// ---- Constantes ----

export interface GrupoMuscular {
  id: string;
  nombre: string;
  color: string;
  icon: string;
}

export const GRUPOS_MUSCULARES: GrupoMuscular[] = [
  { id: 'pecho', nombre: 'Pecho', color: 'bg-red-500', icon: '💪' },
  { id: 'espalda', nombre: 'Espalda', color: 'bg-blue-500', icon: '🔙' },
  { id: 'hombros', nombre: 'Hombros', color: 'bg-purple-500', icon: '🏋️' },
  { id: 'biceps', nombre: 'Bíceps', color: 'bg-orange-500', icon: '💪' },
  { id: 'triceps', nombre: 'Tríceps', color: 'bg-yellow-500', icon: '🦾' },
  { id: 'cuadriceps', nombre: 'Cuádriceps', color: 'bg-green-500', icon: '🦵' },
  { id: 'femoral', nombre: 'Femoral', color: 'bg-teal-500', icon: '🦵' },
  { id: 'gluteos', nombre: 'Glúteos', color: 'bg-pink-500', icon: '🍑' },
  { id: 'pantorrillas', nombre: 'Pantorrillas', color: 'bg-indigo-500', icon: '🦶' },
  { id: 'trapecio', nombre: 'Trapecio', color: 'bg-cyan-500', icon: '🔺' },
  { id: 'core', nombre: 'Core', color: 'bg-amber-500', icon: '🎯' },
];

export interface TipoEntrenamiento {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;
}

export const TIPOS_ENTRENAMIENTO: TipoEntrenamiento[] = [
  { id: 'push', nombre: 'Push', descripcion: 'Pecho, Hombro, Tríceps', color: 'from-red-500 to-orange-500' },
  { id: 'pull', nombre: 'Pull', descripcion: 'Espalda, Bíceps', color: 'from-blue-500 to-cyan-500' },
  { id: 'pierna', nombre: 'Pierna', descripcion: 'Cuádriceps, Femoral, Glúteos', color: 'from-green-500 to-teal-500' },
  { id: 'hombro', nombre: 'Hombro', descripcion: 'Hombros, Trapecio', color: 'from-purple-500 to-pink-500' },
];
