# Trener - Tu Asistente de Entrenamiento

Una aplicación para gestionar entrenamientos de gimnasio y generar rutinas personalizadas con IA.

## Características

- 📊 **Dashboard** - Visualiza estadísticas de tus entrenamientos
- 💪 **Explorador de Entrenamientos** - Filtra por tipo y grupo muscular
- 📅 **Calendario** - Visualiza tus entrenamientos por fecha
- 🤖 **Generador de Rutinas con IA** - Crea rutinas personalizadas usando OpenAI

## Requisitos

- Node.js 18+
- API Key de OpenAI (para generar rutinas)

## Instalación

1. Instala las dependencias:

```bash
npm install
```

2. Crea un archivo `.env.local` con tu API key de OpenAI:

```env
OPENAI_API_KEY=tu_api_key_aqui
```

3. Inicia el servidor de desarrollo:

```bash
npm run dev
```

4. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Estructura del Proyecto

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── entrenamientos/   # API para CRUD de entrenamientos
│   │   │   └── generar-rutina/   # API para generar rutinas con IA
│   │   ├── calendario/           # Vista de calendario
│   │   ├── entrenamientos/       # Lista de entrenamientos
│   │   ├── generar/              # Generador de rutinas
│   │   └── page.tsx              # Dashboard principal
│   ├── components/               # Componentes reutilizables
│   ├── lib/                      # Utilidades y funciones
│   └── types/                    # Tipos TypeScript
├── entrenamientos.json           # Base de datos de entrenamientos
└── package.json
```

## Formato de Entrenamientos

Los entrenamientos se almacenan en `entrenamientos.json` con el siguiente formato:

```json
{
  "id": "2026-01-15-push",
  "nombre": "Push - Pecho, Hombro y Tríceps",
  "tipo": "push",
  "fecha": "2026-01-15",
  "grupos_musculares": ["pecho", "hombros", "triceps"],
  "ejercicios": [
    {
      "nombre": "Press de pecho en máquina",
      "series": 4,
      "repeticiones": 10,
      "peso_kg": 40
    }
  ]
}
```

## Tecnologías

- **Next.js 14** - Framework de React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **OpenAI API** - Generación de rutinas con IA
- **date-fns** - Manejo de fechas
- **Lucide React** - Iconos
