// Tipos para los entrenamientos
export interface Ejercicio {
  nombre: string;
  series: number;
  repeticiones: number | number[];
  peso_kg: number | number[] | string;
}

export interface Entrenamiento {
  _id?: {
    $oid: string;
  };
  id: string;
  nombre: string;
  tipo: 'push' | 'pull' | 'pierna' | 'hombro' | 'core' | string;
  fecha: string;
  grupos_musculares: string[];
  ejercicios: Ejercicio[];
}

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

export const TIPOS_ENTRENAMIENTO = [
  { id: 'push', nombre: 'Push', descripcion: 'Pecho, Hombro, Tríceps', color: 'from-red-500 to-orange-500' },
  { id: 'pull', nombre: 'Pull', descripcion: 'Espalda, Bíceps', color: 'from-blue-500 to-cyan-500' },
  { id: 'pierna', nombre: 'Pierna', descripcion: 'Cuádriceps, Femoral, Glúteos', color: 'from-green-500 to-teal-500' },
  { id: 'hombro', nombre: 'Hombro', descripcion: 'Hombros, Trapecio', color: 'from-purple-500 to-pink-500' },
];
