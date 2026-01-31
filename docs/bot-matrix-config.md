# 🤖 Configuración del Bot de Matrix para Trener

## Resumen
Este bot escucha mensajes en Matrix y responde con información de entrenamientos.

## Configuración en n8n

### 1. Trigger de Matrix (Webhook o Polling)
Como Matrix es self-hosted en `matrix.juanmontoya.me`, puedes usar:

**Opción A: Matrix Webhook (Recomendado)**
- Configura un Application Service en tu servidor Matrix
- O usa un bot que haga polling al servidor

**Opción B: Polling con HTTP Request**
```
Endpoint: https://matrix.juanmontoya.me/_matrix/client/r0/sync
Headers: Authorization: Bearer 20af94821288db22cd94af8c4cc1f38956ecd995f5a26abf8f8320459d926efd
```

### 2. Workflow de n8n

```json
{
  "name": "Trener Bot Matrix",
  "nodes": [
    {
      "name": "Recibir Mensaje",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "https://matrix.juanmontoya.me/_matrix/client/r0/sync",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {
          "timeout": 30000
        }
      },
      "notes": "Polling del servidor Matrix"
    },
    {
      "name": "Filtrar Mensajes",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json.rooms.join['!IOCZuxbnlAhsDKcUvG:matrix.juanmontoya.me'].timeline.events[0].content.body}}",
              "operation": "isNotEmpty"
            }
          ]
        }
      }
    },
    {
      "name": "Consultar Bot API",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://localhost:8000/api/bot/query",
        "body": {
          "mensaje": "={{$json.content.body}}",
          "sender": "={{$json.sender}}"
        },
        "contentType": "application/json"
      }
    },
    {
      "name": "Responder en Matrix",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "PUT",
        "url": "https://matrix.juanmontoya.me/_matrix/client/r0/rooms/!IOCZuxbnlAhsDKcUvG:matrix.juanmontoya.me/send/m.room.message/{{$randomString}}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "body": {
          "msgtype": "m.text",
          "body": "={{$json.respuesta}}",
          "format": "org.matrix.custom.html",
          "formatted_body": "={{$json.respuesta.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>').replace(/\\n/g, '<br>')}}"
        },
        "contentType": "application/json"
      }
    }
  ]
}
```

### 3. Credenciales Requeridas

```
MATRIX_HOMESERVER=https://matrix.juanmontoya.me
MATRIX_ACCESS_TOKEN=20af94821288db22cd94af8c4cc1f38956ecd995f5a26abf8f8320459d926efd
MATRIX_ROOM_ID=!IOCZuxbnlAhsDKcUvG:matrix.juanmontoya.me
TRENER_API=http://localhost:8000
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

## Integración Alternativa: Bot Python Directo

Si prefieres un bot Python en lugar de n8n:

```python
# bot_matrix.py
import asyncio
import httpx
from nio import AsyncClient, RoomMessageText

HOMESERVER = "https://matrix.juanmontoya.me"
USER_ID = "@jarvis:matrix.juanmontoya.me"
ACCESS_TOKEN = "20af94821288db22cd94af8c4cc1f38956ecd995f5a26abf8f8320459d926efd"
ROOM_ID = "!IOCZuxbnlAhsDKcUvG:matrix.juanmontoya.me"
TRENER_API = "http://localhost:8000"

async def message_callback(room, event):
    if event.sender == USER_ID:
        return  # Ignorar mensajes propios
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{TRENER_API}/api/bot/query",
            json={"mensaje": event.body, "sender": event.sender}
        )
        data = response.json()
        
        # Enviar respuesta
        await matrix_client.room_send(
            room_id=ROOM_ID,
            message_type="m.room.message",
            content={"msgtype": "m.text", "body": data["respuesta"]}
        )

async def main():
    global matrix_client
    matrix_client = AsyncClient(HOMESERVER, USER_ID)
    matrix_client.access_token = ACCESS_TOKEN
    
    matrix_client.add_event_callback(message_callback, RoomMessageText)
    
    await matrix_client.sync_forever(timeout=30000)

if __name__ == "__main__":
    asyncio.run(main())
```

Instalar: `pip install matrix-nio httpx`
