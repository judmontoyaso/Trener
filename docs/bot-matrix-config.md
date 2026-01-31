# 🤖 Configuración del Bot de Matrix para Trener

## Resumen
Este bot escucha mensajes en Matrix y responde con información de entrenamientos.

## Variables de Entorno Requeridas

Crea un archivo `.env` en la carpeta `bot-matrix/`:

```env
# Matrix
MATRIX_HOMESERVER=https://tu-servidor-matrix.com
MATRIX_ACCESS_TOKEN=<tu_token_aqui>
MATRIX_BOT_USER_ID=@tu-bot:tu-servidor.com
MATRIX_ROOM_ID=!room_id:tu-servidor.com

# APIs
TRENER_API_URL=http://localhost:8000
N8N_WEBHOOK_URL=<tu_webhook_n8n>
N8N_WEBHOOK_TEST_URL=<tu_webhook_test_n8n>
```

## Comandos Soportados

El bot responde a mensajes naturales:

| Mensaje | Respuesta |
|---------|-----------|
| "¿Qué entrené esta semana?" | Resumen semanal |
| "¿Cuál es mi racha?" | Racha de entrenamientos |
| "Mis récords" / "PRs" | Mejores marcas personales |
| "Último entrenamiento" | Detalles del último workout |
| "Mis estadísticas" | Stats generales |
| "Mis logros" | Perfil de gamificación |
| "Genera una rutina de push" | Sugerencia para generar |

## Prueba del Endpoint

```bash
curl -X POST http://localhost:8000/api/bot/query \
  -H "Content-Type: application/json" \
  -d '{"mensaje": "¿Qué entrené esta semana?"}'
```

## Instalación del Bot

```bash
cd bot-matrix
npm install
npm install dotenv  # Para variables de entorno

# Crear .env con las credenciales
# Luego ejecutar:
node bot.js
```

## Ejecución con PM2 (producción)

```bash
pm2 start bot.js --name matrix-bot
pm2 save
```
