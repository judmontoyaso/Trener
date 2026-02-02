const sdk = require('matrix-js-sdk');
const axios = require('axios');
require('dotenv').config();

// Timestamp de inicio del bot para filtrar mensajes antiguos
const BOT_START_TIME = Date.now();

// Configuración de robustez
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

// ================== KEYWORDS PARA REGISTRO DE EJERCICIOS ==================
const INICIAR_ENTRENAMIENTO_KEYWORDS = [
    'iniciar entrenamiento', 'empezar entrenamiento', 'comenzar entrenamiento',
    'nuevo entrenamiento', 'voy al gym', 'voy al gimnasio',
    'empiezo', 'arranco', 'inicio sesion', 'inicio sesión'
];

const TERMINAR_ENTRENAMIENTO_KEYWORDS = [
    'terminar', 'finalizar', 'acabé', 'acabe', 'terminé', 'termine',
    'guardar entrenamiento', 'listo', 'ya acabé', 'ya termine',
    'fin entrenamiento', 'cerrar sesion', 'cerrar sesión'
];

const CANCELAR_ENTRENAMIENTO_KEYWORDS = [
    'cancelar', 'descartar', 'borrar entrenamiento', 'no guardar'
];

// Patrones que indican registro de ejercicio (números + nombre de ejercicio)
const EJERCICIO_PATTERN = /^[a-záéíóúñ\s]+([\d]+[\s,]*)+/i;

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
        
        // Siempre usar Trener AI - es más inteligente y tiene contexto del usuario
        console.log('🏋️ Procesando con Trener AI');
        reply = await processWithTrenerAI(message, sender);
        
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
        const msgLower = message.toLowerCase().trim();
        
        // === DETECTAR COMANDOS DE ENTRENAMIENTO ===
        
        // 1. Iniciar entrenamiento
        if (INICIAR_ENTRENAMIENTO_KEYWORDS.some(k => msgLower.includes(k))) {
            return await iniciarEntrenamiento(sender);
        }
        
        // 2. Terminar/guardar entrenamiento
        if (TERMINAR_ENTRENAMIENTO_KEYWORDS.some(k => msgLower.includes(k))) {
            return await finalizarEntrenamiento(sender);
        }
        
        // 3. Cancelar entrenamiento
        if (CANCELAR_ENTRENAMIENTO_KEYWORDS.some(k => msgLower.includes(k))) {
            return await cancelarEntrenamiento(sender);
        }
        
        // 4. Detectar si parece registro de ejercicio (tiene números y texto)
        const tieneNumeros = /\d/.test(message);
        const tieneTextoEjercicio = /[a-záéíóúñ]{3,}/i.test(message);
        const noEsPregunta = !message.includes('?') && !msgLower.startsWith('cuanto') && !msgLower.startsWith('cuánto');
        
        // Si hay entrenamiento activo y parece un ejercicio, registrarlo
        if (tieneNumeros && tieneTextoEjercicio && noEsPregunta) {
            const entrenamientoActivo = await verificarEntrenamientoActivo(sender);
            if (entrenamientoActivo || looksLikeExercise(message)) {
                return await registrarEjercicio(message, sender);
            }
        }
        
        // === DETECTAR SI NECESITA CONSULTAR BASE DE DATOS ===
        // Usar MCP para preguntas sobre datos/historial
        const necesitaMCP = [
            'cuánto', 'cuanto', 'cuántas', 'cuantas',
            'mi progreso', 'mi historial', 'mis entrenamientos',
            'último', 'ultima', 'pasado', 'anterior',
            'pr', 'récord', 'record', 'máximo', 'maximo',
            'esta semana', 'semana pasada',
            'he hecho', 'hice', 'entrené',
            'busca', 'encuentra', 'muéstrame', 'muestrame'
        ].some(k => msgLower.includes(k));
        
        // Obtener contexto previo de la conversación
        const contexto = conversationContext.get(sender) || [];
        
        // Usar endpoint MCP si necesita consultar datos
        const endpoint = necesitaMCP ? '/api/chat/mcp' : '/api/chat';
        console.log(`🔧 Usando endpoint: ${endpoint} (necesitaMCP: ${necesitaMCP})`);
        
        const response = await axios.post(`${TRENER_API_URL}${endpoint}`, {
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

// ================== FUNCIONES DE REGISTRO DE ENTRENAMIENTO ==================

async function verificarEntrenamientoActivo(sender) {
    try {
        const response = await axios.get(`${TRENER_API_URL}/api/chat/entrenamiento-actual/${encodeURIComponent(sender)}`, {
            timeout: 5000
        });
        return response.data.activo;
    } catch {
        return false;
    }
}

function looksLikeExercise(message) {
    // Patrones comunes de ejercicios
    const patterns = [
        /\d+\s*(kg|lb)/i,           // Tiene peso con unidad
        /\d+\s*[x*]\s*\d+/i,        // Tiene formato 4x10
        /\d+\s+\d+\s+\d+/,          // Múltiples números seguidos (series)
        /(press|remo|curl|jalón|jalon|sentadilla|peso muerto|dominadas|aperturas|elevaciones|fondos)/i
    ];
    return patterns.some(p => p.test(message));
}

async function iniciarEntrenamiento(sender) {
    try {
        const response = await axios.post(`${TRENER_API_URL}/api/chat/iniciar-entrenamiento`, {
            usuario_id: sender
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        return response.data.mensaje;
    } catch (err) {
        console.error('❌ Error iniciando entrenamiento:', err.message);
        return '❌ No pude iniciar el entrenamiento. Intenta de nuevo.';
    }
}

async function registrarEjercicio(texto, sender) {
    try {
        const response = await axios.post(`${TRENER_API_URL}/api/chat/registrar-ejercicio`, {
            texto: texto,
            usuario_id: sender
        }, {
            timeout: 15000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        return response.data.mensaje;
    } catch (err) {
        console.error('❌ Error registrando ejercicio:', err.message);
        return '❌ No pude registrar ese ejercicio. ¿Puedes reformularlo?';
    }
}

async function finalizarEntrenamiento(sender) {
    try {
        const response = await axios.post(`${TRENER_API_URL}/api/chat/finalizar-entrenamiento`, {
            usuario_id: sender
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        return response.data.mensaje;
    } catch (err) {
        console.error('❌ Error finalizando entrenamiento:', err.message);
        return '❌ No pude guardar el entrenamiento. Intenta de nuevo.';
    }
}

async function cancelarEntrenamiento(sender) {
    try {
        const response = await axios.post(`${TRENER_API_URL}/api/chat/cancelar-entrenamiento`, {
            usuario_id: sender
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        return response.data.mensaje;
    } catch (err) {
        console.error('❌ Error cancelando entrenamiento:', err.message);
        return '❌ No pude cancelar el entrenamiento.';
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
