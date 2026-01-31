const sdk = require('matrix-js-sdk');
const axios = require('axios');

// Timestamp de inicio del bot para filtrar mensajes antiguos
const BOT_START_TIME = Date.now();

const N8N_ENV = process.env.N8N_ENV || 'prod';

// Configuración de robustez
const N8N_TIMEOUT = 30000; // 30 segundos
const TRENER_TIMEOUT = 10000; // 10 segundos para Trener (más rápido)
const MAX_RETRIES = 3;
const RATE_LIMIT_WINDOW = 10000; // 10 segundos
const MAX_MESSAGES_PER_WINDOW = 5; // Máximo 5 mensajes por usuario cada 10 segundos

// Rate limiting: Map para rastrear mensajes por usuario
const userMessageTimestamps = new Map();

// ================== CONFIG ==================
const HOMESERVER_URL = 'https://matrix.juanmontoya.me';
const BOT_USER_ID = '@jarvis:matrix.juanmontoya.me';
const ACCESS_TOKEN = '20af94821288db22cd94af8c4cc1f38956ecd995f5a26abf8f8320459d926efd';

// URLs de los servicios
const TRENER_API_URL = 'http://localhost:8000'; // Backend de Trener en el mismo servidor
const N8N_WEBHOOK_URL =
    N8N_ENV === 'test'
        ? 'https://mi-n8n-app-b5870ec6a262.herokuapp.com/webhook-test/matrix'
        : 'https://mi-n8n-app-b5870ec6a262.herokuapp.com/webhook/matrix';

// ================== KEYWORDS PARA DETECTAR TEMAS DE GYM ==================
const GYM_KEYWORDS = [
    'entrené', 'entrenamiento', 'entreno', 'gimnasio', 'gym',
    'rutina', 'ejercicio', 'ejercicios', 'workout',
    'pecho', 'espalda', 'pierna', 'hombro', 'biceps', 'triceps',
    'push', 'pull', 'leg', 'legs',
    'peso', 'pesas', 'series', 'repeticiones', 'reps',
    'racha', 'streak', 'pr', 'récord', 'record', 'records',
    'estadística', 'estadisticas', 'stats',
    'logro', 'logros', 'nivel', 'xp',
    'semana', 'semanal', // cuando pregunta por semana probablemente es de gym
    'último entrenamiento', 'ultima rutina',
    'cuánto levanto', 'cuanto levanto', 'máximo', 'maximo'
];

// ================== CLIENT ==================
const client = sdk.createClient({
    baseUrl: HOMESERVER_URL,
    accessToken: ACCESS_TOKEN,
    userId: BOT_USER_ID,
});

// ================== AUTO JOIN ROOMS ==================
client.on('RoomMember.membership', async (event, member) => {
    if (member.membership === 'invite' && member.userId === BOT_USER_ID) {
        try {
            console.log(`Invitación recibida → ${member.roomId}`);
            await client.joinRoom(member.roomId);
            console.log(`Unido a la sala ${member.roomId}`);
        } catch (err) {
            console.error('Error al unirse a la sala:', err.message);
        }
    }
});

// ================== MESSAGE LISTENER ==================
client.on('Room.timeline', async (event, room, toStartOfTimeline) => {
    if (toStartOfTimeline) return;
    if (!room) return;
    if (event.getType() !== 'm.room.message') return;
    if (event.getTs() < BOT_START_TIME) return;

    const content = event.getContent();
    if (!content || content.msgtype !== 'm.text') return;

    const sender = event.getSender();
    if (sender === BOT_USER_ID) return;

    const message = content.body;
    const roomId = room.roomId;

    // Rate limiting
    if (!checkRateLimit(sender)) {
        console.log(`⚠️ Rate limit excedido para ${sender}`);
        return;
    }

    console.log(`[${room.name || roomId}] ${sender}: ${message}`);

    try {
        await client.sendTyping(roomId, true, 30000);
        
        let reply;
        
        // Detectar si es una consulta de gimnasio
        if (isGymRelated(message)) {
            console.log('🏋️ Detectado como consulta de gimnasio → Trener');
            reply = await processWithTrener(message, sender);
        } else {
            console.log('🤖 Enviando a n8n');
            reply = await processWithN8N(message, sender, roomId);
        }
        
        await client.sendTyping(roomId, false);
        await client.sendTextMessage(roomId, reply);
    } catch (err) {
        await client.sendTyping(roomId, false);
        console.error('Error enviando respuesta:', err.message);
    }
});

// ================== DETECTAR SI ES TEMA DE GYM ==================
function isGymRelated(message) {
    const msgLower = message.toLowerCase();
    return GYM_KEYWORDS.some(keyword => msgLower.includes(keyword));
}

// ================== RATE LIMITING ==================
function checkRateLimit(sender) {
    const now = Date.now();
    
    if (!userMessageTimestamps.has(sender)) {
        userMessageTimestamps.set(sender, []);
    }
    
    const timestamps = userMessageTimestamps.get(sender);
    const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
    
    if (recentTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
        return false;
    }
    
    recentTimestamps.push(now);
    userMessageTimestamps.set(sender, recentTimestamps);
    
    return true;
}

// ================== TRENER API ==================
async function processWithTrener(message, sender) {
    try {
        const response = await axios.post(`${TRENER_API_URL}/api/bot/query`, {
            mensaje: message,
            sender: sender
        }, {
            timeout: TRENER_TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Respuesta Trener:', response.data);

        if (response.data && response.data.respuesta) {
            return response.data.respuesta;
        }

        return 'No pude obtener información del gimnasio.';

    } catch (err) {
        console.error('❌ Error consultando Trener:', err.message);
        
        // Si Trener falla, dar una respuesta útil
        if (err.code === 'ECONNREFUSED') {
            return '⚠️ El servicio de gimnasio no está disponible. Asegúrate de que el backend de Trener esté corriendo.';
        }
        
        return 'Error consultando datos del gimnasio. Intenta de nuevo.';
    }
}

// ================== N8N ==================
async function processWithN8N(message, sender, roomId) {
    let lastError;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await axios.post(N8N_WEBHOOK_URL, {
                message,
                sender,
                roomId,
                timestamp: Date.now()
            }, {
                timeout: N8N_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log(`✅ Respuesta n8n (intento ${attempt}):`, response.data);

            if (typeof response.data === 'string') {
                return response.data;
            }

            if (Array.isArray(response.data)) {
                return response.data[0]?.text
                    || response.data[0]?.message
                    || JSON.stringify(response.data[0]);
            }

            if (typeof response.data === 'object') {
                return response.data.text
                    || response.data.message
                    || JSON.stringify(response.data);
            }

            return 'Respuesta vacía del workflow';

        } catch (err) {
            lastError = err;
            console.error(`❌ Error en n8n (intento ${attempt}/${MAX_RETRIES}):`, err.message);
            
            if (attempt < MAX_RETRIES) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                console.log(`⏳ Reintentando en ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    console.error('🚨 Todos los reintentos fallaron:', lastError.message);
    return 'Lo siento, el servicio está temporalmente no disponible. Intenta de nuevo en unos momentos.';
}

// ================== ERROR HANDLING ==================
client.on('sync', (state, prevState) => {
    if (state === 'ERROR') {
        console.error('⚠️ Error de sincronización. Estado anterior:', prevState);
    } else if (state === 'RECONNECTING') {
        console.log('🔄 Reconectando al servidor...');
    } else if (state === 'SYNCING') {
        console.log('🔄 Sincronizando...');
    } else if (state === 'PREPARED') {
        console.log('✅ Cliente preparado y sincronizado');
    }
});

client.on('error', (err) => {
    console.error('🚨 Error del cliente Matrix:', err.message);
});

// ================== START BOT ==================
async function start() {
    try {
        console.log('🚀 Iniciando bot con soporte para Trener...');
        console.log(`📍 Trener API: ${TRENER_API_URL}`);
        console.log(`📍 n8n Webhook: ${N8N_WEBHOOK_URL}`);

        await client.startClient({
            initialSyncLimit: 1
        });

        console.log('🤖 Bot conectado y escuchando mensajes 👂');
        console.log('🏋️ Palabras clave de gym:', GYM_KEYWORDS.slice(0, 10).join(', ') + '...');
    } catch (err) {
        console.error('Error iniciando bot:', err);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⏹️ Deteniendo bot...');
    await client.stopClient();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⏹️ Deteniendo bot...');
    await client.stopClient();
    process.exit(0);
});

start();
