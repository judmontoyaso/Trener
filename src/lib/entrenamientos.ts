import { Entrenamiento } from '@/types';
import entrenamientosData from '../../entrenamientos.json';

// Cargar entrenamientos desde el archivo JSON
export function getEntrenamientos(): Entrenamiento[] {
  return entrenamientosData as Entrenamiento[];
}

// Obtener entrenamiento por ID
export function getEntrenamientoById(id: string): Entrenamiento | undefined {
  const entrenamientos = getEntrenamientos();
  return entrenamientos.find(e => e.id === id);
}

// Filtrar entrenamientos por tipo
export function getEntrenamientosPorTipo(tipo: string): Entrenamiento[] {
  const entrenamientos = getEntrenamientos();
  return entrenamientos.filter(e => e.tipo === tipo);
}

// Filtrar entrenamientos por grupo muscular
export function getEntrenamientosPorGrupoMuscular(grupo: string): Entrenamiento[] {
  const entrenamientos = getEntrenamientos();
  return entrenamientos.filter(e => 
    e.grupos_musculares.some(g => g.toLowerCase() === grupo.toLowerCase())
  );
}

// Obtener entrenamientos por rango de fechas
export function getEntrenamientosPorFecha(fechaInicio: string, fechaFin: string): Entrenamiento[] {
  const entrenamientos = getEntrenamientos();
  return entrenamientos.filter(e => {
    const fecha = new Date(e.fecha);
    return fecha >= new Date(fechaInicio) && fecha <= new Date(fechaFin);
  });
}

// Obtener estadísticas generales
export function getEstadisticas() {
  const entrenamientos = getEntrenamientos();
  
  const totalEntrenamientos = entrenamientos.length;
  const totalEjercicios = entrenamientos.reduce((acc, e) => acc + e.ejercicios.length, 0);
  
  // Contar por tipo
  const porTipo = entrenamientos.reduce((acc, e) => {
    acc[e.tipo] = (acc[e.tipo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Contar por grupo muscular
  const porGrupo = entrenamientos.reduce((acc, e) => {
    e.grupos_musculares.forEach(g => {
      acc[g] = (acc[g] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  
  // Obtener ejercicios únicos
  const ejerciciosUnicos = new Set<string>();
  entrenamientos.forEach(e => {
    e.ejercicios.forEach(ej => ejerciciosUnicos.add(ej.nombre));
  });
  
  return {
    totalEntrenamientos,
    totalEjercicios,
    ejerciciosUnicos: ejerciciosUnicos.size,
    porTipo,
    porGrupo,
  };
}

// Agrupar entrenamientos por fecha
export function agruparPorFecha(): Record<string, Entrenamiento[]> {
  const entrenamientos = getEntrenamientos();
  return entrenamientos.reduce((acc, e) => {
    if (!acc[e.fecha]) {
      acc[e.fecha] = [];
    }
    acc[e.fecha].push(e);
    return acc;
  }, {} as Record<string, Entrenamiento[]>);
}

// Obtener fechas únicas ordenadas
export function getFechasOrdenadas(): string[] {
  const entrenamientos = getEntrenamientos();
  const fechasSet = new Set(entrenamientos.map(e => e.fecha));
  const fechas = Array.from(fechasSet);
  return fechas.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
}
