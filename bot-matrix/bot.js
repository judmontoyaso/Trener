const sdk = require('matrix-js-sdk');
const axios = require('axios');
require('dotenv').config();

// ================== LOGGING ==================
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

const log = {
    debug: (...args) => LOG_LEVEL <= LOG_LEVELS.DEBUG && console.log('[DEBUG]', new Date().toISOString(), ...args),
    info:  (...args) => LOG_LEVEL <= LOG_LEVELS.INFO  && console.log('[INFO]',  new Date().toISOString(), ...args),
    warn:  (...args) => LOG_LEVEL <= LOG_LEVELS.WARN  && console.warn('[WARN]', new Date().toISOString(), ...args),
    error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
};

// ================== CONFIG ==================
const BOT_START_TIME = Date.now();

const TRENER_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;
const RATE_LIMIT_WINDOW = 10000;
const MAX_MESSAGES_PER_WINDOW = 5;
const CONTEXT_MAX_AGE = 2 * 3600000; // 2 horas
const CONTEXT_MAX_MESSAGES = 20;      // Máximo mensajes en contexto
const MESSAGE_SEND_DELAY = 300;       // Delay entre mensajes para evitar rate limit de Matrix

const HOMESERVER_URL = process.env.MATRIX_HOMESERVER || 'https://matrix.juanmontoya.me';
const BOT_USER_ID = process.env.MATRIX_BOT_USER_ID || '@jarvis:matrix.juanmontoya.me';
const ACCESS_TOKEN = process.env.MATRIX_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
    log.error('MATRIX_ACCESS_TOKEN no está configurado');
    process.exit(1);
}

const TRENER_API_URL = process.env.TRENER_API_URL || 'http://localhost:8000';

// ================== STATE ==================
const userMessageTimestamps = new Map();
const conversationContext = new Map(); // key: `${roomId}:${sender}`
const activeWorkouts = new Map();      // Cache de entrenamientos activos por sender

// ================== KEYWORDS PARA REGISTRO DE EJERCICIOS ==================
const INICIAR_ENTRENAMIENTO_KEYWORDS = [
    'iniciar entrenamiento', 'empezar entrenamiento', 'comenzar entrenamiento',
    'nuevo entrenamiento', 'voy al gym', 'voy al gimnasio',
    'empiezo a entrenar', 'arranco entrenamiento', 'inicio sesion', 'inicio sesión'
];

const TERMINAR_ENTRENAMIENTO_KEYWORDS = [
    'terminar entrenamiento', 'finalizar entrenamiento',
    'acabé entrenamiento', 'terminé entrenamiento',
    'guardar entrenamiento', 'ya acabé', 'ya termine',
    'fin entrenamiento', 'cerrar sesion', 'cerrar sesión'
];

const CANCELAR_ENTRENAMIENTO_KEYWORDS = [
    'cancelar entrenamiento', 'descartar entrenamiento',
    'borrar entrenamiento', 'no guardar'
];

// Palabras sueltas que terminan/cancelan solo si hay entrenamiento activo
const TERMINAR_CORTAS = ['terminar', 'finalizar', 'listo', 'acabé', 'terminé'];
const CANCELAR_CORTAS = ['cancelar', 'descartar'];

// ================== EXERCISE DETECTION ==================
const EJERCICIO_PATTERNS = [
    /\d+\s*(kg|lb|kgs|lbs)/i,                           // Peso con unidad
    /\d+\s*[x*×]\s*\d+/i,                               // Formato 4x10
    /\d+\s+\d+\s+\d+/,                                  // Múltiples números seguidos
    /(press|remo|curl|jalón|jalon|sentadilla|peso muerto|dominadas|aperturas|elevaciones|fondos|polea|mancuerna|barra|predicador|martillo|lateral|frontal|copa|extensión|prensa|zancada|hip thrust|plancha|crunch)/i
];

function looksLikeExercise(message) {
    const hasNumber = /\d/.test(message);
    if (!hasNumber) return false;
    return EJERCICIO_PATTERNS.some(p => p.test(message));
}

// ================== SLASH COMMANDS ==================
const SLASH_COMMANDS = {
    '/help': {
        description: 'Muestra comandos disponibles',
        handler: async () => formatHtml(
            '<h4>🤖 Comandos de Trener Bot</h4>' +
            '<b>Entrenamiento:</b><br/>' +
            '• <code>iniciar entrenamiento</code> — Empezar a registrar<br/>' +
            '• <code>Press banca 60kg 4x10</code> — Registrar ejercicio<br/>' +
            '• <code>terminar</code> — Guardar y finalizar<br/>' +
            '• <code>cancelar</code> — Descartar sesión<br/><br/>' +
            '<b>Consultas:</b><br/>' +
            '• <i>"¿Qué entrené esta semana?"</i><br/>' +
            '• <i>"¿Cuál es mi racha?"</i><br/>' +
            '• <i>"Mis récords personales"</i><br/>' +
            '• <i>"Genera una rutina de push"</i><br/><br/>' +
            '<b>Comandos:</b><br/>' +
            '• <code>/help</code> — Este mensaje<br/>' +
            '• <code>/status</code> — Estado del entrenamiento actual<br/>' +
            '• <code>/stats</code> — Estadísticas rápidas<br/>' +
            '• <code>/clear</code> — Limpiar contexto de conversación'
        ),
    },
    '/status': {
        description: 'Estado del entrenamiento actual',
        handler: async (sender) => {
            const activo = await verificarEntrenamientoActivo(sender);
            if (!activo) {
                return formatHtml('📋 <b>No hay entrenamiento en curso.</b><br/>Di <code>iniciar entrenamiento</code> para comenzar.');
            }
            const detalle = await obtenerDetalleEntrenamiento(sender);
            if (!detalle) {
                return formatHtml('🏋️ <b>Entrenamiento activo</b> (sin detalles disponibles)');
            }
            let html = `🏋️ <b>Entrenamiento en curso</b><br/>`;
            html += `📅 Fecha: ${detalle.fecha}<br/>`;
            html += `📝 Ejercicios: ${detalle.ejercicios}<br/>`;
            if (detalle.detalle?.length > 0) {
                html += '<br/>';
                detalle.detalle.forEach(ej => {
                    html += `• <b>${ej.nombre}</b>: ${ej.series}s @ ${ej.peso}kg<br/>`;
                });
            }
            html += `<br/><i>Di 'terminar' para guardar o 'cancelar' para descartar</i>`;
            return formatHtml(html);
        },
    },
    '/stats': {
        description: 'Estadísticas rápidas',
        handler: async (sender) => {
            try {
                const response = await apiCall('POST', '/api/bot/query', {
                    mensaje: 'mis estadísticas',
                    sender,
                });
                return response.data?.respuesta || 'No pude obtener estadísticas.';
            } catch {
                return '⚠️ Error obteniendo estadísticas.';
            }
        },
    },
    '/clear': {
        description: 'Limpiar contexto de conversación',
        handler: async (_sender, _message, contextKey) => {
            conversationContext.delete(contextKey);
            return formatHtml('🧹 <b>Contexto limpiado.</b> La próxima conversación empieza desde cero.');
        },
    },
};

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
            log.info(`Invitación recibida → ${member.roomId}`);
            await client.joinRoom(member.roomId);
            log.info(`Unido a la sala ${member.roomId}`);
            // Enviar mensaje de bienvenida
            await sendHtmlMessage(
                member.roomId,
                '👋 ¡Hola! Soy <b>Trener Bot</b>, tu asistente de gimnasio.\n\nEscribe <code>/help</code> para ver los comandos disponibles.'
            );
        } catch (err) {
            log.error('Error al unirse a la sala:', err.message);
        }
    }
});

// ================== MESSAGE LISTENER ==================
client.on('Room.timeline', async (event, room, toStartOfTimeline) => {
    if (toStartOfTimeline || !room) return;
    if (event.getType() !== 'm.room.message') return;
    if (event.getTs() < BOT_START_TIME) return;

    const content = event.getContent();
    if (!content || content.msgtype !== 'm.text') return;

    const sender = event.getSender();
    if (sender === BOT_USER_ID) return;

    const message = content.body?.trim();
    if (!message) return;
    
    const roomId = room.roomId;
    const contextKey = `${roomId}:${sender}`;

    // Rate limiting
    if (!checkRateLimit(sender)) {
        log.warn(`Rate limit excedido para ${sender}`);
        await sendHtmlMessage(roomId, '⏳ <i>Estás enviando mensajes muy rápido. Espera un momento.</i>');
        return;
    }

    log.info(`[${room.name || roomId}] ${sender}: ${message}`);

    try {
        await client.sendTyping(roomId, true, 30000);

        let reply;

        // 1. Check slash commands first
        const command = message.split(' ')[0].toLowerCase();
        if (SLASH_COMMANDS[command]) {
            reply = await SLASH_COMMANDS[command].handler(sender, message, contextKey);
        } else {
            // 2. Process with Trener AI
            reply = await processWithTrenerAI(message, sender, contextKey);
        }

        await client.sendTyping(roomId, false);

        // Send response (supports long messages)
        await sendLongMessage(roomId, reply);

    } catch (err) {
        await client.sendTyping(roomId, false).catch(() => {});
        log.error('Error procesando mensaje:', err.message);
        await sendHtmlMessage(roomId, '❌ <i>Error procesando tu mensaje. Intenta de nuevo.</i>');
    }
});

// ================== HTML MESSAGE HELPERS ==================
function formatHtml(html) {
    // Return object that sendHtmlMessage can detect
    return { __html: true, html, plain: htmlToPlain(html) };
}

function htmlToPlain(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(b|strong)>/gi, '**')
        .replace(/<\/?(i|em)>/gi, '_')
        .replace(/<code>/gi, '`').replace(/<\/code>/gi, '`')
        .replace(/<\/?(h[1-6])>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
}

function markdownToHtml(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/_(.+?)_/g, '<i>$1</i>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br/>');
}

async function sendHtmlMessage(roomId, content) {
    if (typeof content === 'object' && content.__html) {
        return client.sendMessage(roomId, {
            msgtype: 'm.text',
            body: content.plain,
            format: 'org.matrix.custom.html',
            formatted_body: content.html,
        });
    }
    
    const html = markdownToHtml(content);
    const plain = typeof content === 'string' ? content : '';
    
    return client.sendMessage(roomId, {
        msgtype: 'm.text',
        body: plain,
        format: 'org.matrix.custom.html',
        formatted_body: html,
    });
}

async function sendLongMessage(roomId, reply) {
    const text = typeof reply === 'object' && reply.__html ? reply.plain : reply;
    
    if (text.length <= 4000) {
        await sendHtmlMessage(roomId, reply);
    } else {
        const chunks = splitMessage(text, 4000);
        for (const chunk of chunks) {
            await sendHtmlMessage(roomId, chunk);
            await sleep(MESSAGE_SEND_DELAY);
        }
    }
}

// ================== API CALL WITH RETRIES ==================
async function apiCall(method, path, data = null, options = {}) {
    const { timeout = TRENER_TIMEOUT, retries = MAX_RETRIES } = options;
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const config = {
                method,
                url: `${TRENER_API_URL}${path}`,
                timeout,
                headers: { 'Content-Type': 'application/json' },
            };
            if (data) config.data = data;

            const response = await axios(config);
            return response;
        } catch (err) {
            lastError = err;
            
            // Don't retry on client errors (4xx)
            if (err.response?.status >= 400 && err.response?.status < 500) {
                throw err;
            }

            if (attempt < retries) {
                const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                log.warn(`API intento ${attempt}/${retries} falló (${err.message}), reintentando en ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    throw lastError;
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

// ================== CONTEXT MANAGEMENT ==================
function getContext(contextKey) {
    const ctx = conversationContext.get(contextKey);
    if (!ctx) return [];
    
    // Expire stale context
    if (Date.now() - ctx.lastActivity > CONTEXT_MAX_AGE) {
        conversationContext.delete(contextKey);
        return [];
    }
    
    return ctx.messages;
}

function updateContext(contextKey, serverContext) {
    const existing = conversationContext.get(contextKey) || { messages: [], lastActivity: 0 };
    
    conversationContext.set(contextKey, {
        messages: (serverContext || existing.messages).slice(-CONTEXT_MAX_MESSAGES),
        lastActivity: Date.now(),
    });
}

// ================== TRENER AI (Chat Inteligente) ==================
async function processWithTrenerAI(message, sender, contextKey) {
    try {
        const msgLower = message.toLowerCase().trim();
        
        // === DETECTAR COMANDOS DE ENTRENAMIENTO ===
        
        // 1. Iniciar entrenamiento
        if (INICIAR_ENTRENAMIENTO_KEYWORDS.some(k => msgLower.includes(k))) {
            return await iniciarEntrenamiento(sender);
        }
        
        // 2. Terminar/guardar entrenamiento (frases completas)
        if (TERMINAR_ENTRENAMIENTO_KEYWORDS.some(k => msgLower.includes(k))) {
            return await finalizarEntrenamiento(sender);
        }
        
        // 3. Cancelar entrenamiento (frases completas)
        if (CANCELAR_ENTRENAMIENTO_KEYWORDS.some(k => msgLower.includes(k))) {
            return await cancelarEntrenamiento(sender);
        }
        
        // 4. Palabras cortas de terminar/cancelar SOLO si hay entrenamiento activo
        if (TERMINAR_CORTAS.some(k => msgLower === k || msgLower.startsWith(k + ' '))) {
            const activo = await verificarEntrenamientoActivo(sender);
            if (activo) return await finalizarEntrenamiento(sender);
        }
        
        if (CANCELAR_CORTAS.some(k => msgLower === k || msgLower.startsWith(k + ' '))) {
            const activo = await verificarEntrenamientoActivo(sender);
            if (activo) return await cancelarEntrenamiento(sender);
        }
        
        // 5. Detectar si parece registro de ejercicio
        const noEsPregunta = !message.includes('?') && !msgLower.startsWith('cuanto') && !msgLower.startsWith('cuánto');
        
        if (noEsPregunta && looksLikeExercise(message)) {
            const entrenamientoActivo = await verificarEntrenamientoActivo(sender);
            if (entrenamientoActivo) {
                return await registrarEjercicio(message, sender);
            }
            // Si parece ejercicio pero no hay entrenamiento, auto-iniciar
            const hasExplicitWeight = /\d+\s*(kg|lb)/i.test(message);
            const hasExplicitFormat = /\d+\s*[x*×]\s*\d+/i.test(message);
            if (hasExplicitWeight || hasExplicitFormat) {
                log.info(`Auto-iniciando entrenamiento para ${sender}`);
                await iniciarEntrenamiento(sender);
                return await registrarEjercicio(message, sender);
            }
        }
        
        // === CHAT INTELIGENTE ===
        
        // Determinar si necesita consultar base de datos (MCP)
        const necesitaMCP = [
            'cuánto', 'cuanto', 'cuántas', 'cuantas',
            'mi progreso', 'mi historial', 'mis entrenamientos',
            'último', 'ultima', 'pasado', 'anterior',
            'pr', 'récord', 'record', 'máximo', 'maximo',
            'esta semana', 'semana pasada', 'este mes',
            'he hecho', 'hice', 'entrené',
            'busca', 'encuentra', 'muéstrame', 'muestrame',
            'comparar', 'versus', 'diferencia',
        ].some(k => msgLower.includes(k));
        
        const contexto = getContext(contextKey);
        const endpoint = necesitaMCP ? '/api/chat/mcp' : '/api/chat';
        log.debug(`Endpoint: ${endpoint} (MCP: ${necesitaMCP})`);
        
        const response = await apiCall('POST', endpoint, {
            mensaje: message,
            contexto,
        });

        log.info(`Respuesta Trener AI: tipo=${response.data?.tipo}`);

        if (response.data) {
            // Guardar contexto actualizado
            if (response.data.contexto_actualizado) {
                updateContext(contextKey, response.data.contexto_actualizado);
            } else {
                updateContext(contextKey, null);
            }
            
            // Si generó una rutina, formatearla con HTML
            if (response.data.tipo === 'rutina_generada' && response.data.rutina) {
                return formatRutina(response.data.rutina);
            }
            
            return response.data.respuesta || 'No obtuve respuesta del asistente.';
        }

        return 'No pude procesar tu mensaje.';

    } catch (err) {
        log.error('Error Trener AI:', err.message);
        
        // Fallback al endpoint básico
        return await processWithTrenerBasic(message, sender);
    }
}

// ================== FORMAT HELPERS ==================
function formatRutina(rutina) {
    let html = `<h4>🏋️ ${rutina.nombre}</h4>`;
    html += `📅 ${rutina.fecha} | 💪 ${rutina.grupos_musculares.join(', ')}<br/><br/>`;
    html += `<b>📋 Ejercicios:</b><br/>`;
    
    rutina.ejercicios.forEach((ej, i) => {
        const peso = ej.peso_kg === 'ajustar' ? '?' : `${ej.peso_kg}kg`;
        html += `${i + 1}. <b>${ej.nombre}</b>: ${ej.series}×${ej.repeticiones} @ ${peso}<br/>`;
    });
    
    html += `<br/><i>💡 ¿Quieres que la inicie o la modifico?</i>`;
    return formatHtml(html);
}

// ================== FUNCIONES DE ENTRENAMIENTO ==================

async function verificarEntrenamientoActivo(sender) {
    // Check cache first (valid for 30 seconds)
    const cached = activeWorkouts.get(sender);
    if (cached && Date.now() - cached.timestamp < 30000) {
        return cached.activo;
    }

    try {
        const response = await apiCall('GET', `/api/chat/entrenamiento-actual/${encodeURIComponent(sender)}`, null, {
            timeout: 5000,
            retries: 1,
        });
        const activo = response.data?.activo || false;
        activeWorkouts.set(sender, { activo, timestamp: Date.now() });
        return activo;
    } catch {
        return false;
    }
}

async function obtenerDetalleEntrenamiento(sender) {
    try {
        const response = await apiCall('GET', `/api/chat/entrenamiento-actual/${encodeURIComponent(sender)}`, null, {
            timeout: 5000,
            retries: 1,
        });
        return response.data?.activo ? response.data : null;
    } catch {
        return null;
    }
}

async function iniciarEntrenamiento(sender) {
    try {
        const response = await apiCall('POST', '/api/chat/iniciar-entrenamiento', {
            usuario_id: sender,
        }, { timeout: 10000 });
        
        // Invalidate cache
        activeWorkouts.delete(sender);
        
        return response.data?.mensaje || '🏋️ Entrenamiento iniciado.';
    } catch (err) {
        log.error('Error iniciando entrenamiento:', err.message);
        return '❌ No pude iniciar el entrenamiento. Intenta de nuevo.';
    }
}

async function registrarEjercicio(texto, sender) {
    try {
        const response = await apiCall('POST', '/api/chat/registrar-ejercicio', {
            texto,
            usuario_id: sender,
        }, { timeout: 15000 });
        
        return response.data?.mensaje || '✅ Ejercicio registrado.';
    } catch (err) {
        log.error('Error registrando ejercicio:', err.message);
        return '❌ No pude registrar ese ejercicio. ¿Puedes reformularlo?\n\nEjemplos:\n• `Press banca 60kg 4x10`\n• `Remo 15 20 25 30` (pesos progresivos)';
    }
}

async function finalizarEntrenamiento(sender) {
    try {
        const response = await apiCall('POST', '/api/chat/finalizar-entrenamiento', {
            usuario_id: sender,
        }, { timeout: 10000 });
        
        // Invalidate cache
        activeWorkouts.delete(sender);
        
        return response.data?.mensaje || '✅ Entrenamiento guardado.';
    } catch (err) {
        log.error('Error finalizando entrenamiento:', err.message);
        return '❌ No pude guardar el entrenamiento. Intenta de nuevo.';
    }
}

async function cancelarEntrenamiento(sender) {
    try {
        const response = await apiCall('POST', '/api/chat/cancelar-entrenamiento', {
            usuario_id: sender,
        }, { timeout: 10000 });
        
        // Invalidate cache
        activeWorkouts.delete(sender);
        
        return response.data?.mensaje || '🗑️ Entrenamiento cancelado.';
    } catch (err) {
        log.error('Error cancelando entrenamiento:', err.message);
        return '❌ No pude cancelar el entrenamiento.';
    }
}

// ================== TRENER BÁSICO (Fallback) ==================
async function processWithTrenerBasic(message, sender) {
    try {
        const response = await apiCall('POST', '/api/bot/query', {
            mensaje: message,
            sender,
        }, { timeout: 10000, retries: 2 });

        return response.data?.respuesta || 'No pude obtener información del gimnasio.';

    } catch (err) {
        log.error('Error Trener básico:', err.message);
        
        if (err.code === 'ECONNREFUSED') {
            return '⚠️ El servicio de gimnasio no está disponible. Verifica que el backend esté corriendo.';
        }
        
        return 'Error consultando datos del gimnasio. Intenta de nuevo en un momento.';
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
        
        // Try to split on double newline (paragraph break)
        let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
        
        // Fall back to single newline
        if (splitIndex === -1 || splitIndex < maxLength / 3) {
            splitIndex = remaining.lastIndexOf('\n', maxLength);
        }
        
        // Fall back to space
        if (splitIndex === -1 || splitIndex < maxLength / 3) {
            splitIndex = remaining.lastIndexOf(' ', maxLength);
        }
        
        // Hard split as last resort
        if (splitIndex === -1) {
            splitIndex = maxLength;
        }
        
        chunks.push(remaining.substring(0, splitIndex));
        remaining = remaining.substring(splitIndex).trim();
    }
    
    return chunks;
}

// ================== CLEANUP INTERVALS ==================
// Clean stale contexts and caches every 30 minutes
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, ctx] of conversationContext) {
        if (now - ctx.lastActivity > CONTEXT_MAX_AGE) {
            conversationContext.delete(key);
            cleaned++;
        }
    }
    
    for (const [sender, timestamps] of userMessageTimestamps) {
        const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
        if (recent.length === 0) {
            userMessageTimestamps.delete(sender);
        } else {
            userMessageTimestamps.set(sender, recent);
        }
    }
    
    // Clean workout cache (entries older than 5 minutes)
    for (const [sender, cache] of activeWorkouts) {
        if (now - cache.timestamp > 300000) {
            activeWorkouts.delete(sender);
        }
    }
    
    if (cleaned > 0) log.debug(`Limpiados ${cleaned} contextos expirados`);
}, 1800000);

// ================== SYNC & ERROR HANDLING ==================
let reconnectAttempts = 0;

client.on('sync', (state, prevState) => {
    switch (state) {
        case 'PREPARED':
            reconnectAttempts = 0;
            log.info('Cliente sincronizado y listo');
            break;
        case 'SYNCING':
            if (prevState === 'RECONNECTING') {
                reconnectAttempts = 0;
                log.info('Reconexión exitosa');
            }
            break;
        case 'RECONNECTING':
            reconnectAttempts++;
            log.warn(`Reconectando... (intento ${reconnectAttempts})`);
            break;
        case 'ERROR':
            log.error(`Error de sincronización (reconexiones: ${reconnectAttempts})`);
            break;
        case 'STOPPED':
            log.warn('Cliente detenido');
            break;
    }
});

client.on('error', (err) => {
    log.error('Error Matrix SDK:', err.message);
});

// ================== HEALTH CHECK ==================
async function checkBackendHealth() {
    try {
        const response = await axios.get(`${TRENER_API_URL}/api/health`, { timeout: 5000 });
        return response.data?.status === 'ok';
    } catch {
        return false;
    }
}

// ================== START ==================
async function start() {
    try {
        log.info('Iniciando Trener Bot AI...');
        log.info(`Trener API: ${TRENER_API_URL}`);
        log.info(`Homeserver: ${HOMESERVER_URL}`);
        log.info(`Bot User: ${BOT_USER_ID}`);

        // Health check del backend
        const backendOk = await checkBackendHealth();
        if (backendOk) {
            log.info('Backend Trener: OK');
        } else {
            log.warn('Backend Trener: NO DISPONIBLE — el bot funcionará pero las respuestas fallarán');
        }

        await client.startClient({
            initialSyncLimit: 1,
        });

        log.info('Bot conectado — Modo AI activado');
        log.info('Comandos disponibles: /help, /status, /stats, /clear');
        
    } catch (err) {
        log.error('Error fatal iniciando bot:', err);
        process.exit(1);
    }
}

// ================== GRACEFUL SHUTDOWN ==================
async function shutdown(signal) {
    log.info(`Señal ${signal} recibida, deteniendo bot...`);
    
    try {
        await client.stopClient();
    } catch (err) {
        log.error('Error deteniendo cliente:', err.message);
    }
    
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
    log.error('Excepción no capturada:', err);
    // Don't exit — let the Matrix SDK reconnect
});
process.on('unhandledRejection', (reason) => {
    log.error('Promise rejection no manejada:', reason);
});

start();
