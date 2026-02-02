# Configuración MCP MongoDB para Trener

## ¿Qué es un MCP Server?

El Model Context Protocol (MCP) permite que GitHub Copilot acceda directamente a fuentes de datos externas, como bases de datos MongoDB, para responder preguntas con información en tiempo real.

## Configuración realizada

Se ha configurado el MCP server de MongoDB en `.vscode/settings.json` con:

- **Servidor**: `mongodb-trener`
- **Base de datos**: `n8n_memoria`
- **Colecciones disponibles**:
  - `gimnasio` - Entrenamientos registrados
  - `entrenamiento_activo` - Entrenamientos en progreso
  - `equipamiento` - Equipamiento disponible
  - `logros` - Logros y achievements
  - `usuario_gym` - Datos del usuario

## Cómo usar

Ahora puedes hacer preguntas directamente al agente como:

### Consultas de entrenamientos
- "¿Cuántos entrenamientos hice en enero?"
- "Muéstrame mis últimos 5 entrenamientos de tipo push"
- "¿Cuál fue mi mejor record de peso en press de banca?"
- "¿Qué entrenamientos hice la semana pasada?"

### Análisis de progreso
- "¿Cómo ha evolucionado mi peso en sentadillas?"
- "¿Cuáles son mis ejercicios más frecuentes?"
- "¿Qué grupos musculares he trabajado más este mes?"

### Logros y racha
- "¿Cuál es mi racha actual?"
- "Muéstrame mis logros desbloqueados"
- "¿Cuánto XP tengo?"

### Equipamiento
- "¿Qué equipamiento tengo registrado?"
- "¿Qué ejercicios puedo hacer con mancuernas?"

## Verificación

1. Recarga la ventana de VS Code (Ctrl+Shift+P → "Developer: Reload Window")
2. Abre el chat de Copilot
3. Pregunta: "¿Cuántos entrenamientos tengo registrados?"

El agente debería conectarse a tu base de datos MongoDB y responder con datos reales.

## Troubleshooting

Si el MCP no funciona:

1. **Verifica que Node.js esté instalado**: `node --version`
2. **Verifica la conexión a MongoDB**: Asegúrate que la URI en `.env.local` esté actualizada
3. **Recarga VS Code**: El MCP solo se carga al iniciar
4. **Revisa la consola de salida**: Ve a "Output" → "GitHub Copilot Chat MCP" para logs

## Seguridad

⚠️ **Importante**: La URI de MongoDB con credenciales está en `.vscode/settings.json`. Asegúrate de que este archivo esté en `.gitignore` para no exponer credenciales.

Para mayor seguridad, considera:
- Usar variables de entorno en lugar de hardcodear la URI
- Crear un usuario de MongoDB de solo lectura para el MCP
- Limitar las colecciones accesibles

## Alternativa con variables de entorno

Para usar variables de entorno en lugar de hardcodear la URI:

```json
{
  "github.copilot.chat.mcp.servers": {
    "mongodb-trener": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-mongodb"
      ],
      "env": {
        "MONGODB_URI": "${env:MONGO_URI}"
      }
    }
  }
}
```

Luego agrega `MONGO_URI` a tus variables de entorno del sistema.
