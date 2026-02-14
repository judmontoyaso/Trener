import type {
  Entrenamiento,
  Estadisticas,
  ResumenAI,
  ComparativaSemanal,
  PerfilGamificacion,
  Logro,
  EjercicioFrecuente,
  ProgresoEjercicio,
  VolumenSemanal,
  OneRmEstimacion,
  ChatResponse,
} from '@/types';

// ---- Configuración ----

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      // respuesta no JSON
    }
    throw new ApiError(detail, res.status);
  }

  return res.json();
}

// ---- Entrenamientos ----

export async function fetchEntrenamientos(): Promise<Entrenamiento[]> {
  return apiFetch<Entrenamiento[]>('/api/entrenamientos');
}

export async function fetchEntrenamiento(id: string): Promise<Entrenamiento> {
  return apiFetch<Entrenamiento>(`/api/entrenamientos/${id}`);
}

export async function crearEntrenamiento(
  entrenamiento: Omit<Entrenamiento, '_id'>
): Promise<{ success: boolean; entrenamiento: Entrenamiento }> {
  return apiFetch('/api/entrenamientos', {
    method: 'POST',
    body: JSON.stringify(entrenamiento),
  });
}

export async function eliminarEntrenamiento(
  id: string
): Promise<{ success: boolean }> {
  return apiFetch(`/api/entrenamientos/${id}`, { method: 'DELETE' });
}

// ---- Estadísticas ----

export async function fetchEstadisticas(): Promise<Estadisticas> {
  return apiFetch<Estadisticas>('/api/estadisticas');
}

// ---- Generación de rutinas ----

export async function generarRutina(params: {
  tipo: string;
  grupos_musculares?: string[];
  objetivo: string;
  duracion_minutos: number;
  nivel: string;
  notas?: string;
}): Promise<{ rutina: Entrenamiento }> {
  return apiFetch('/api/generar-rutina', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ---- Entrenamiento Activo ----

export async function fetchEntrenamientoActivo(): Promise<{
  activo: boolean;
  entrenamiento: Entrenamiento | null;
}> {
  return apiFetch('/api/entrenamiento-activo');
}

export async function iniciarEntrenamientoActivo(
  entrenamiento: Entrenamiento
): Promise<{ success: boolean; entrenamiento_activo: Entrenamiento }> {
  return apiFetch('/api/entrenamiento-activo/iniciar', {
    method: 'POST',
    body: JSON.stringify(entrenamiento),
  });
}

export async function actualizarSerie(data: {
  ejercicio_index: number;
  serie: { numero: number; repeticiones: number; peso_kg: number; completada: boolean };
}): Promise<{ success: boolean; ejercicio: unknown }> {
  return apiFetch('/api/entrenamiento-activo/actualizar-serie', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function completarEjercicioActivo(
  index: number
): Promise<{ success: boolean }> {
  return apiFetch(`/api/entrenamiento-activo/completar-ejercicio/${index}`, {
    method: 'PUT',
  });
}

export async function finalizarEntrenamientoActivo(
  enviarMatrix: boolean = true
): Promise<{
  success: boolean;
  duracion_minutos: number;
  ejercicios_completados: number;
  total_ejercicios: number;
  resumen: string;
  matrix: string | null;
}> {
  return apiFetch('/api/entrenamiento-activo/finalizar', {
    method: 'POST',
    body: JSON.stringify({ enviar_matrix: enviarMatrix }),
  });
}

export async function cancelarEntrenamientoActivo(): Promise<{
  success: boolean;
  eliminados: number;
}> {
  return apiFetch('/api/entrenamiento-activo/cancelar', { method: 'DELETE' });
}

export async function recalcularPesos(): Promise<{
  success: boolean;
  entrenamiento: Entrenamiento;
}> {
  return apiFetch('/api/entrenamiento-activo/recalcular-pesos', {
    method: 'PUT',
  });
}

// ---- Progreso ----

export async function fetchProgresoEjercicio(
  nombre: string
): Promise<{ ejercicio: string; progreso: ProgresoEjercicio[] }> {
  return apiFetch(`/api/progreso/ejercicio/${encodeURIComponent(nombre)}`);
}

export async function fetchVolumenSemanal(): Promise<{
  volumen_semanal: VolumenSemanal[];
}> {
  return apiFetch('/api/progreso/volumen');
}

export async function fetchProgresoGrupos(): Promise<{
  por_grupo: Record<string, { entrenamientos: number; series: number }>;
}> {
  return apiFetch('/api/progreso/grupos');
}

export async function fetchEjerciciosFrecuentes(
  limit: number = 0
): Promise<{ ejercicios: EjercicioFrecuente[]; total: number }> {
  const query = limit > 0 ? `?limit=${limit}` : '';
  return apiFetch(`/api/progreso/ejercicios-frecuentes${query}`);
}

// ---- Métricas avanzadas ----

export async function fetchOneRm(): Promise<{
  estimaciones: OneRmEstimacion[];
}> {
  return apiFetch('/api/metricas/1rm');
}

export async function fetchComparativaSemanal(): Promise<ComparativaSemanal> {
  return apiFetch<ComparativaSemanal>('/api/metricas/comparativa-semanal');
}

export async function fetchResumenInteligente(): Promise<ResumenAI> {
  return apiFetch<ResumenAI>('/api/metricas/resumen-inteligente');
}

// ---- Gamificación ----

export async function fetchPerfilGamificacion(): Promise<PerfilGamificacion> {
  return apiFetch<PerfilGamificacion>('/api/gamificacion/perfil');
}

export async function fetchLogros(): Promise<{ logros: Logro[] }> {
  return apiFetch('/api/gamificacion/logros');
}

// ---- Chat ----

export async function enviarChat(
  mensaje: string,
  contexto?: Array<{ role: string; content: string }>
): Promise<ChatResponse> {
  return apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ mensaje, contexto }),
  });
}

export async function enviarChatMCP(
  mensaje: string,
  contexto?: Array<{ role: string; content: string }>
): Promise<ChatResponse> {
  return apiFetch('/api/chat/mcp', {
    method: 'POST',
    body: JSON.stringify({ mensaje, contexto }),
  });
}

// ---- Equipamiento ----

export async function fetchEquipamiento(): Promise<Entrenamiento[]> {
  return apiFetch('/api/equipamiento');
}

// ---- Health ----

export async function checkHealth(): Promise<{
  status: string;
  database: string;
  version: string;
}> {
  return apiFetch('/api/health');
}
