import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Entrenamiento, Ejercicio } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerarRutinaRequest {
  tipo: string;
  grupos_musculares?: string[];
  objetivo: string;
  duracion_minutos: number;
  nivel: string;
  notas?: string;
  entrenamientos_recientes?: Entrenamiento[];
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerarRutinaRequest = await request.json();
    const {
      tipo,
      grupos_musculares,
      objetivo,
      duracion_minutos,
      nivel,
      notas,
      entrenamientos_recientes,
    } = body;

    // Construir el contexto de entrenamientos anteriores
    let contextoEntrenamientos = '';
    if (entrenamientos_recientes && entrenamientos_recientes.length > 0) {
      contextoEntrenamientos = `
Estos son algunos entrenamientos recientes del usuario para que uses como referencia de ejercicios que le gustan y pesos que maneja:

${entrenamientos_recientes.map((e) => `
- ${e.nombre} (${e.fecha}):
  ${e.ejercicios.map((ej) => `  * ${ej.nombre}: ${ej.series}x${ej.repeticiones} @ ${typeof ej.peso_kg === 'string' ? ej.peso_kg : ej.peso_kg + 'kg'}`).join('\n')}
`).join('\n')}
`;
    }

    const gruposTexto = grupos_musculares && grupos_musculares.length > 0
      ? `Grupos musculares específicos: ${grupos_musculares.join(', ')}`
      : `Tipo de entrenamiento: ${tipo} (usa los grupos musculares típicos para este tipo)`;

    const prompt = `Eres un entrenador personal experto. Genera una rutina de entrenamiento en formato JSON.

Parámetros:
- ${gruposTexto}
- Objetivo: ${objetivo}
- Nivel del usuario: ${nivel}
- Duración aproximada: ${duracion_minutos} minutos
${notas ? `- Notas adicionales del usuario: ${notas}` : ''}

${contextoEntrenamientos}

Genera una rutina de entrenamiento completa y efectiva. Devuelve SOLO un JSON válido con esta estructura exacta (sin markdown, sin explicaciones):

{
  "id": "fecha-tipo",
  "nombre": "Nombre descriptivo del entrenamiento",
  "tipo": "${tipo}",
  "fecha": "${new Date().toISOString().split('T')[0]}",
  "grupos_musculares": ["grupo1", "grupo2"],
  "ejercicios": [
    {
      "nombre": "Nombre del ejercicio",
      "series": 4,
      "repeticiones": 10,
      "peso_kg": "ajustar según nivel"
    }
  ]
}

Incluye entre 6-8 ejercicios apropiados para el objetivo y nivel. Para peso_kg, usa valores numéricos basados en los entrenamientos anteriores cuando sea posible, o la cadena "ajustar según nivel" si no tienes referencia.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un entrenador personal experto que genera rutinas de ejercicios. Siempre respondes con JSON válido sin formato markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const respuesta = completion.choices[0].message.content;
    
    if (!respuesta) {
      throw new Error('No se recibió respuesta de OpenAI');
    }

    // Limpiar la respuesta de posibles marcadores de código
    let jsonString = respuesta.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.slice(7);
    }
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.slice(3);
    }
    if (jsonString.endsWith('```')) {
      jsonString = jsonString.slice(0, -3);
    }
    jsonString = jsonString.trim();

    const rutina: Entrenamiento = JSON.parse(jsonString);

    // Asegurar que tiene un ID único
    rutina.id = `${rutina.fecha}-${rutina.tipo}-${Date.now()}`;

    return NextResponse.json({ rutina });
  } catch (error) {
    console.error('Error generando rutina:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'API key de OpenAI no configurada. Añade OPENAI_API_KEY a tus variables de entorno.' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error desconocido al generar la rutina' },
      { status: 500 }
    );
  }
}
