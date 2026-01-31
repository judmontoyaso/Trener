// Configuración de la API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchEntrenamientos() {
  const res = await fetch(`${API_BASE_URL}/api/entrenamientos`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Error al obtener entrenamientos');
  return res.json();
}

export async function fetchEstadisticas() {
  const res = await fetch(`${API_BASE_URL}/api/estadisticas`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Error al obtener estadísticas');
  return res.json();
}

export async function crearEntrenamiento(entrenamiento: any) {
  const res = await fetch(`${API_BASE_URL}/api/entrenamientos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrenamiento),
  });
  if (!res.ok) throw new Error('Error al crear entrenamiento');
  return res.json();
}

export async function eliminarEntrenamiento(id: string) {
  const res = await fetch(`${API_BASE_URL}/api/entrenamientos/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar entrenamiento');
  return res.json();
}

export async function generarRutina(params: {
  tipo: string;
  grupos_musculares?: string[];
  objetivo: string;
  duracion_minutos: number;
  nivel: string;
  notas?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/api/generar-rutina`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Error al generar rutina');
  }
  return res.json();
}
