/**
 * Proxy API route - redirige al backend FastAPI.
 * El frontend llama directamente al backend via NEXT_PUBLIC_API_URL.
 * Este endpoint existe como fallback por compatibilidad.
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/api/generar-rutina`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy] Error generando rutina:', error);
    return NextResponse.json(
      { error: 'Backend no disponible' },
      { status: 502 }
    );
  }
}
