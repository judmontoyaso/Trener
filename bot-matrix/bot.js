const sdk = require('matrix-js-sdk');
const axios = require('axios');
require('dotenv').config();

// Timestamp de inicio del bot para filtrar mensajes antiguos
const BOT_START_TIME = Date.now();

const N8N_ENV = process.env.N8N_ENV || 'prod';

// Configuración de robustez
const N8N_TIMEOUT = 30000;
const TRENER_TIMEOUT = 30000; // Más tiempo para AI
const MAX_RETRIES = 3;
const RATE_LIMIT_WINDOW = 10000;
const MAX_MESSAGES_PER_WINDOW = 5;

// Rate limiting y contexto de conversación
const userMessageTimestamps = new Map();
const conversationContext = new Map(); // Guardar contexto por usuario

// ================== CONFIG ==================
const HOMESERVER_URL = process.env.MATRIX_HOMESERVER || 'https://matrix.juanmontoya.me';
const BOT_USER_ID = process.env.MATRIX_BOT_USER_ID || '@jarvis:matrix.juanmontoya.me';
const ACCESS_TOKEN = process.env.MATRIX_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
    console.error('ERROR: MATRIX_ACCESS_TOKEN no está configurado');
    process.exit(1);
}

const TRENER_API_URL = process.env.TRENER_API_URL || 'http://localhost:8000';
const N8N_WEBHOOK_URL =
    N8N_ENV === 'test'
        ? process.env.N8N_WEBHOOK_TEST_URL || 'https://mi-n8n-app-b5870ec6a262.herokuapp.com/webhook-test/matrix'
        : process.env.N8N_WEBHOOK_URL || 'https://mi-n8n-app-b5870ec6a262.herokuapp.com/webhook/matrix';

// ================== KEYWORDS PARA GYM ==================
const GYM_KEYWORDS = [
    'entrené', 'entrenamiento', 'entreno', 'gimnasio', 'gym',
    'rutina', 'ejercicio', 'ejercicios', 'workout',
    'pecho', 'espalda', 'pierna', 'hombro', 'biceps', 'triceps',
    'push', 'pull', 'leg', 'legs',
    'peso', 'pesas', 'series', 'repeticiones', 'reps',
    'racha', 'streak', 'pr', 'récord', 'record', 'records',
    'estadística', 'estadisticas', 'stats',
    'logro', 'logros', 'nivel', 'xp',
    'semana', 'semanal',
    'último entrenamiento', 'ultima rutina',
    'cuánto levanto', 'cuanto levanto', 'máximo', 'maximo',
    // Nuevas keywords para AI
    'genera', 'generar', 'crea', 'crear', 'hazme', 'dame',
    '1rm', 'fuerza', 'volumen', 'progreso',
    'consejo', 'tip', 'ayuda', 'recomienda',
    'cuántas', 'cuantas', 'debería', 'deberia'
];

// ================== CLIENT ==================
const client = sdk.createClient({
    baseUrl: HOMESERVER_URL,
    accessToken: ACCESS_TOKEN,
    userId: BOT_USER_ID,
});

// ================== AUTO JOIN ==================
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

    if (!checkRateLimit(sender)) {
        console.log(`⚠️ Rate limit excedido para ${sender}`);
        return;
    }

    console.log(`[${room.name || roomId}] ${sender}: ${message}`);

    try {
        await client.sendTyping(roomId, true, 30000);
        
        let reply;
        
        if (isGymRelated(message)) {
            console.log('🏋️ Detectado como consulta de gimnasio → Trener AI');
            reply = await processWithTrenerAI(message, sender);
        } else {
            console.log('🤖 Enviando a n8n');
            reply = await processWithN8N(message, sender, roomId);
        }
        
        await client.sendTyping(roomId, false);
        
        // Enviar respuesta (soporta múltiples mensajes si es muy largo)
        if (reply.length > 4000) {
            const chunks = splitMessage(reply, 4000);
            for (const chunk of chunks) {
                await client.sendTextMessage(roomId, chunk);
                await sleep(500);
            }
        } else {
            await client.sendTextMessage(roomId, reply);
        }
        
    } catch (err) {
        await client.sendTyping(roomId, false);
        console.error('Error enviando respuesta:', err.message);
    }
});

// ================== DETECTAR TEMA GYM ==================
function isGymRelated(message) {
    const msgLower = normalizeText(message.toLowerCase());
    return GYM_KEYWORDS.some(keyword => msgLower.includes(normalizeText(keyword)));
}

function normalizeText(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

// ================== TRENER AI (Chat Inteligente) ==================
async function processWithTrenerAI(message, sender) {
    try {
        // Obtener contexto previo de la conversación
        const contexto = conversationContext.get(sender) || [];
        
        const response = await axios.post(`${TRENER_API_URL}/api/chat`, {
            mensaje: message,
            contexto: contexto
        }, {
            timeout: TRENER_TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Respuesta Trener AI:', response.data.tipo);

        if (response.data) {
            // Guardar contexto actualizado para mantener la conversación
            if (response.data.contexto_actualizado) {
                conversationContext.set(sender, response.data.contexto_actualizado);
            }
            
            // Si generó una rutina, formatearla bonita
            if (response.data.tipo === 'rutina_generada' && response.data.rutina) {
                const rutina = response.data.rutina;
                let msg = `🏋️ **${rutina.nombre}**\n`;
                msg += `📅 ${rutina.fecha} | 💪 ${rutina.grupos_musculares.join(', ')}\n\n`;
                msg += `📋 **Ejercicios:**\n`;
                
                rutina.ejercicios.forEach((ej, i) => {
                    const peso = ej.peso_kg === 'ajustar' ? '?' : `${ej.peso_kg}kg`;
                    msg += `${i + 1}. **${ej.nombre}**: ${ej.series}x${ej.repeticiones} @ ${peso}\n`;
                });
                
                msg += `\n💡 _¿Quieres que la inicie o la modifico?_`;
                return msg;
            }
            
            return response.data.respuesta || 'No obtuve respuesta del asistente.';
        }

        return 'No pude procesar tu mensaje.';

    } catch (err) {
        console.error('❌ Error Trener AI:', err.message);
        
        // Fallback al endpoint básico
        return await processWithTrenerBasic(message, sender);
    }
}

// ================== TRENER BÁSICO (Fallback) ==================
async function processWithTrenerBasic(message, sender) {
    try {
        const response = await axios.post(`${TRENER_API_URL}/api/bot/query`, {
            mensaje: message,
            sender: sender
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.respuesta) {
            return response.data.respuesta;
        }

        return 'No pude obtener información del gimnasio.';

    } catch (err) {
        console.error('❌ Error Trener básico:', err.message);
        
        if (err.code === 'ECONNREFUSED') {
            return '⚠️ El servicio de gimnasio no está disponible.';
        }
        
        return 'Error consultando datos del gimnasio.';
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

            console.log(`✅ Respuesta n8n (intento ${attempt})`);

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
            console.error(`❌ Error n8n (intento ${attempt}/${MAX_RETRIES}):`, err.message);
            
            if (attempt < MAX_RETRIES) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                await sleep(delay);
            }
        }
    }
    
    return 'Lo siento, el servicio está temporalmente no disponible.';
}

// ================== UTILS ==================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function splitMessage(text, maxLength) {
    const chunks = [];
    let remaining = text;
    
    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }
        
        let splitIndex = remaining.lastIndexOf('\n', maxLength);
        if (splitIndex === -1 || splitIndex < maxLength / 2) {
            splitIndex = remaining.lastIndexOf(' ', maxLength);
        }
        if (splitIndex === -1) {
            splitIndex = maxLength;
        }
        
        chunks.push(remaining.substring(0, splitIndex));
        remaining = remaining.substring(splitIndex).trim();
    }
    
    return chunks;
}

// Limpiar contextos viejos cada hora
setInterval(() => {
    const oneHourAgo = Date.now() - 3600000;
    for (const [sender, timestamps] of userMessageTimestamps) {
        if (timestamps.length === 0 || timestamps[timestamps.length - 1] < oneHourAgo) {
            userMessageTimestamps.delete(sender);
            conversationContext.delete(sender);
        }
    }
}, 3600000);

// ================== ERROR HANDLING ==================
client.on('sync', (state, prevState) => {
    if (state === 'ERROR') {
        console.error('⚠️ Error de sincronización');
    } else if (state === 'RECONNECTING') {
        console.log('🔄 Reconectando...');
    } else if (state === 'PREPARED') {
        console.log('✅ Cliente preparado');
    }
});

client.on('error', (err) => {
    console.error('🚨 Error Matrix:', err.message);
});

// ================== START ==================
async function start() {
    try {
        console.log('🚀 Iniciando Trener Bot AI...');
        console.log(`📍 Trener API: ${TRENER_API_URL}`);
        console.log(`📍 n8n: ${N8N_WEBHOOK_URL}`);

        await client.startClient({
            initialSyncLimit: 1
        });

        console.log('🤖 Bot conectado - Modo AI activado 🧠');
        console.log('');
        console.log('💬 Comandos de ejemplo:');
        console.log('   "Genera una rutina de push de 45 minutos"');
        console.log('   "¿Qué entrené esta semana?"');
        console.log('   "¿Cuál es mi 1RM en press banca?"');
        console.log('   "Dame consejos para mejorar mi fuerza"');
        
    } catch (err) {
        console.error('Error iniciando bot:', err);
        process.exit(1);
    }
}

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
