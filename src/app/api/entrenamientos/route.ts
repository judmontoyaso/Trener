import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Entrenamiento } from '@/types';

const DATA_FILE = path.join(process.cwd(), 'entrenamientos.json');

// GET - Obtener todos los entrenamientos
export async function GET() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const entrenamientos: Entrenamiento[] = JSON.parse(data);
    return NextResponse.json(entrenamientos);
  } catch (error) {
    console.error('Error leyendo entrenamientos:', error);
    return NextResponse.json(
      { error: 'Error al leer los entrenamientos' },
      { status: 500 }
    );
  }
}

// POST - Añadir un nuevo entrenamiento
export async function POST(request: NextRequest) {
  try {
    const nuevoEntrenamiento: Entrenamiento = await request.json();

    // Leer datos existentes
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const entrenamientos: Entrenamiento[] = JSON.parse(data);

    // Asegurar ID único
    if (!nuevoEntrenamiento.id) {
      nuevoEntrenamiento.id = `${nuevoEntrenamiento.fecha}-${nuevoEntrenamiento.tipo}-${Date.now()}`;
    }

    // Añadir el nuevo entrenamiento
    entrenamientos.push(nuevoEntrenamiento);

    // Guardar
    await fs.writeFile(DATA_FILE, JSON.stringify(entrenamientos, null, 2), 'utf-8');

    return NextResponse.json({ 
      success: true, 
      entrenamiento: nuevoEntrenamiento 
    });
  } catch (error) {
    console.error('Error guardando entrenamiento:', error);
    return NextResponse.json(
      { error: 'Error al guardar el entrenamiento' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un entrenamiento
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID requerido' },
        { status: 400 }
      );
    }

    // Leer datos existentes
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    let entrenamientos: Entrenamiento[] = JSON.parse(data);

    // Filtrar el entrenamiento a eliminar
    const cantidadAntes = entrenamientos.length;
    entrenamientos = entrenamientos.filter((e) => e.id !== id);

    if (entrenamientos.length === cantidadAntes) {
      return NextResponse.json(
        { error: 'Entrenamiento no encontrado' },
        { status: 404 }
      );
    }

    // Guardar
    await fs.writeFile(DATA_FILE, JSON.stringify(entrenamientos, null, 2), 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando entrenamiento:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el entrenamiento' },
      { status: 500 }
    );
  }
}
