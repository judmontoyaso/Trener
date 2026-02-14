/**
 * Catch-all proxy: reenvía todas las llamadas /api/* al backend FastAPI.
 * Esto evita problemas de CORS ya que las peticiones se hacen server-side.
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'https://api.juanmontoya.me';

async function proxyRequest(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const targetUrl = `${BACKEND_URL}${pathname}${search}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      cache: 'no-store',
    };

    // Solo incluir body en métodos que lo permiten
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const body = await request.text();
        if (body) fetchOptions.body = body;
      } catch {
        // Request sin body, está bien
      }
    }

    const res = await fetch(targetUrl, fetchOptions);

    // Intentar devolver como JSON, si no como texto
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    console.error(`[Proxy] ${request.method} ${pathname} → Error:`, error);
    return NextResponse.json(
      { error: 'Backend no disponible', detail: String(error) },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}
