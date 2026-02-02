# 🏋️ Trener - Asistente de Entrenamiento con IA

Sistema completo de tracking de entrenamientos con bot conversacional, generación de rutinas con IA y gamificación.

## 🌐 URLs

- **Frontend**: https://trener-hazel.vercel.app
- **Backend API**: https://api.juanmontoya.me
- **Bot Matrix**: @jarvis:matrix.juanmontoya.me

## ✨ Características

### Frontend (Next.js)
- 📊 Dashboard con estadísticas y progreso
- 💪 Explorador de entrenamientos con filtros
- 📅 Calendario de entrenamientos
- 📈 Gráficas de fuerza con tendencias
- 🎮 Sistema de logros y gamificación
- 🏃 Entrenamiento activo en tiempo real

### Backend (FastAPI)
- 🤖 Chat inteligente con OpenAI (hipertrofia)
- 🔧 MCP MongoDB para consultas avanzadas
- 📊 Métricas y estadísticas detalladas
- 🏆 Sistema de PRs y 1RM estimados
- 🔥 Cálculo de rachas

### Bot Matrix
- 💬 Registro de entrenamientos por chat
- 📋 Generación de rutinas personalizadas
- 📊 Consultas de progreso y estadísticas
- 🎯 Integración con MCP para queries inteligentes

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Python FastAPI, OpenAI GPT-4o-mini |
| Base de datos | MongoDB Atlas |
| Bot | Node.js, matrix-js-sdk |
| Hosting | Vercel (frontend), Digital Ocean (backend/bot) |
| CI/CD | GitHub Actions |

## 📁 Estructura

```
Trener/
├── src/                    # Frontend Next.js
│   ├── app/
│   │   ├── api/            # API routes (proxy a backend)
│   │   ├── progreso/       # Gráficas de fuerza
│   │   ├── logros/         # Sistema de gamificación
│   │   └── entrenamiento-activo/
│   └── components/
├── backend/                # API FastAPI
│   ├── main.py             # Endpoints principales
│   └── mcp_mongo.py        # MCP tools para MongoDB
├── bot-matrix/             # Bot de Matrix
│   └── bot.js
└── .github/workflows/      # CI/CD
    └── deploy.yml
```

## 🚀 Desarrollo Local

### Frontend
```bash
npm install
npm run dev
# http://localhost:3000
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# http://localhost:8000
```

### Bot
```bash
cd bot-matrix
npm install
node bot.js
```

## ⚙️ Variables de Entorno

### Frontend (.env.local)
```env
OPENAI_API_KEY=sk-...
MONGO_URI=mongodb+srv://...
```

### Backend (.env)
```env
OPENAI_API_KEY=sk-...
MONGO_URI=mongodb+srv://...
```

### Bot (.env)
```env
MATRIX_HOMESERVER=https://matrix.example.com
MATRIX_ACCESS_TOKEN=...
MATRIX_BOT_USER_ID=@bot:example.com
TRENER_API_URL=http://localhost:8000
```

## 🔄 Despliegue

El despliegue es automático con GitHub Actions:

1. Push a `main` con cambios en `backend/` o `bot-matrix/`
2. GitHub Actions sube los archivos al servidor
3. PM2 reinicia los servicios

### Comandos del servidor
```bash
pm2 status                    # Ver estado
pm2 restart trener-backend    # Reiniciar backend
pm2 restart matrix-bot        # Reiniciar bot
pm2 logs trener-backend       # Ver logs
```

## 🤖 Uso del Bot

Escribe al bot en Matrix:

| Comando | Acción |
|---------|--------|
| "Hoy hice push: press 80kg, fondos, elevaciones" | Registra entrenamiento |
| "Genera rutina de 4 días" | Crea rutina semanal |
| "¿Cuál es mi PR en press banca?" | Consulta récords |
| "Mi progreso en sentadilla" | Muestra evolución |
| "Resumen de la semana" | Stats semanales |

## 📊 API Endpoints Principales

```
GET  /api/estadisticas          # Stats generales
GET  /api/entrenamientos        # Lista entrenamientos
POST /api/chat                  # Chat inteligente
POST /api/chat/mcp              # Chat con tools MCP
GET  /api/progreso/{ejercicio}  # Historial de ejercicio
GET  /api/prs                   # Personal records
POST /api/generar-rutina        # Genera rutina IA
```

## 📝 Licencia

MIT
