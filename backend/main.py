from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from bson import ObjectId
from pydantic import BaseModel, Field
from typing import List, Optional, Union
from datetime import date, datetime, timedelta
import os
from dotenv import load_dotenv
from openai import OpenAI
import httpx

load_dotenv()

app = FastAPI(title="Trener API", description="API para gestionar entrenamientos de gimnasio")

# CORS para permitir requests desde Next.js (local y producción)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable is required")
client = MongoClient(MONGO_URI)
db = client["n8n_memoria"]
collection = db["gimnasio"]
entrenamiento_activo_collection = db["entrenamiento_activo"]
equipamiento_collection = db["equipamiento"]
logros_collection = db["logros"]
usuario_collection = db["usuario_gym"]

# OpenAI
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Matrix config
MATRIX_HOMESERVER = os.getenv("MATRIX_HOMESERVER", "https://matrix.juanmontoya.me")
MATRIX_ACCESS_TOKEN = os.getenv("MATRIX_ACCESS_TOKEN")
MATRIX_ROOM_ID = os.getenv("MATRIX_ROOM_ID")


# Modelos Pydantic
class Ejercicio(BaseModel):
    nombre: str
    series: int
    repeticiones: Union[int, List[int]]
    peso_kg: Union[int, float, List[Union[int, float]], str]


class EntrenamientoBase(BaseModel):
    id: Optional[str] = None
    nombre: str
    tipo: str
    fecha: str
    grupos_musculares: List[str]
    ejercicios: List[Ejercicio]


class EntrenamientoCreate(EntrenamientoBase):
    pass


class EntrenamientoResponse(EntrenamientoBase):
    mongo_id: Optional[str] = Field(None, alias="_id")

    class Config:
        populate_by_name = True


class GenerarRutinaRequest(BaseModel):
    tipo: str
    grupos_musculares: Optional[List[str]] = None
    objetivo: str
    duracion_minutos: int
    nivel: str
    notas: Optional[str] = None


# Modelos para entrenamiento activo
class SerieRealizada(BaseModel):
    numero: int
    repeticiones: int
    peso_kg: Union[int, float]
    completada: bool = False


class EjercicioRealizado(BaseModel):
    nombre: str
    series_planificadas: int
    repeticiones_objetivo: Union[int, List[int]]
    peso_sugerido: Union[int, float, str]
    series_realizadas: List[SerieRealizada] = []
    completado: bool = False
    notas: Optional[str] = None


# Modelo flexible para iniciar entrenamiento (acepta formato de rutina generada)
class IniciarEntrenamientoRequest(BaseModel):
    id: Optional[str] = None
    nombre: str
    tipo: str
    fecha: str
    grupos_musculares: List[str]
    ejercicios: List[dict]  # Acepta cualquier formato de ejercicio
    notas: Optional[str] = None
    duracion_aprox_min: Optional[int] = None


class ActualizarEjercicioRequest(BaseModel):
    ejercicio_index: int
    serie: SerieRealizada


class FinalizarEntrenamientoRequest(BaseModel):
    enviar_matrix: bool = True


# Modelo para equipamiento
class Equipamiento(BaseModel):
    nombre: str
    tipo: str  # "maquina", "peso_libre", "cable", "cardio"
    grupo_muscular_principal: List[str]
    ejercicios_posibles: List[str]


async def enviar_mensaje_matrix(mensaje: str) -> bool:
    """Envía un mensaje a Matrix"""
    if not MATRIX_ACCESS_TOKEN or not MATRIX_ROOM_ID:
        print("Matrix no configurado")
        return False
    
    try:
        url = f"{MATRIX_HOMESERVER}/_matrix/client/r0/rooms/{MATRIX_ROOM_ID}/send/m.room.message"
        headers = {
            "Authorization": f"Bearer {MATRIX_ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }
        body = {
            "msgtype": "m.text",
            "body": mensaje
        }
        
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(url, json=body, headers=headers)
            print(f"Matrix response: {response.status_code}")
            return response.status_code == 200
    except Exception as e:
        print(f"Error enviando a Matrix: {e}")
        return False


def serialize_doc(doc) -> dict:
    """Convierte un documento de MongoDB a dict serializable"""
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == "_id":
            result["_id"] = str(value)
        else:
            result[key] = value
    return result


@app.get("/")
def root():
    return {"message": "Trener API - Backend para gestión de entrenamientos"}


@app.get("/api/debug/pesos/{ejercicio}")
def debug_pesos(ejercicio: str):
    """Debug: ver qué peso encuentra para un ejercicio"""
    try:
        historial = list(collection.find({}).sort("fecha", -1).limit(20))
        
        nombre_lower = ejercicio.lower().strip()
        palabras_ignorar = {'de', 'con', 'en', 'la', 'el', 'las', 'los', 'a', 'y', 'o', 'para'}
        palabras_clave = [p for p in nombre_lower.split() if p not in palabras_ignorar and len(p) > 2]
        
        matches = []
        for doc in historial:
            for ej in doc.get("ejercicios", []):
                ej_nombre = ej.get("nombre", "").lower()
                score = sum(1 for p in palabras_clave if p in ej_nombre)
                if score > 0:
                    matches.append({
                        "ejercicio_historial": ej.get("nombre"),
                        "peso": ej.get("peso_kg"),
                        "score": score,
                        "fecha": doc.get("fecha")
                    })
        
        matches.sort(key=lambda x: x["score"], reverse=True)
        
        peso_sugerido = obtener_ultimo_peso(ejercicio, ["pecho", "biceps"])
        
        return {
            "ejercicio_buscado": ejercicio,
            "palabras_clave": palabras_clave,
            "total_entrenamientos": len(historial),
            "matches_encontrados": matches[:10],
            "peso_sugerido": peso_sugerido
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/entrenamientos", response_model=List[dict])
def get_entrenamientos():
    """Obtener todos los entrenamientos"""
    try:
        docs = list(collection.find({}))
        return [serialize_doc(doc) for doc in docs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/entrenamientos/{entrenamiento_id}")
def get_entrenamiento(entrenamiento_id: str):
    """Obtener un entrenamiento por ID"""
    try:
        # Intentar buscar por _id de MongoDB
        try:
            doc = collection.find_one({"_id": ObjectId(entrenamiento_id)})
        except:
            # Si no es un ObjectId válido, buscar por campo 'id'
            doc = collection.find_one({"id": entrenamiento_id})
        
        if not doc:
            raise HTTPException(status_code=404, detail="Entrenamiento no encontrado")
        return serialize_doc(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/entrenamientos")
def create_entrenamiento(entrenamiento: EntrenamientoCreate):
    """Crear un nuevo entrenamiento"""
    try:
        doc = entrenamiento.model_dump()
        if not doc.get("id"):
            doc["id"] = f"{doc['fecha']}-{doc['tipo']}-{ObjectId()}"
        
        result = collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return {"success": True, "entrenamiento": doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/entrenamientos/{entrenamiento_id}")
def delete_entrenamiento(entrenamiento_id: str):
    """Eliminar un entrenamiento"""
    try:
        # Intentar eliminar por _id de MongoDB
        try:
            result = collection.delete_one({"_id": ObjectId(entrenamiento_id)})
        except:
            # Si no es un ObjectId válido, eliminar por campo 'id'
            result = collection.delete_one({"id": entrenamiento_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entrenamiento no encontrado")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/estadisticas")
def get_estadisticas():
    """Obtener estadísticas generales"""
    try:
        docs = list(collection.find({}))
        
        total_entrenamientos = len(docs)
        total_ejercicios = sum(len(doc.get("ejercicios", [])) for doc in docs)
        
        # Contar por tipo
        por_tipo = {}
        for doc in docs:
            tipo = doc.get("tipo", "otro")
            por_tipo[tipo] = por_tipo.get(tipo, 0) + 1
        
        # Contar por grupo muscular
        por_grupo = {}
        for doc in docs:
            for grupo in doc.get("grupos_musculares", []):
                por_grupo[grupo] = por_grupo.get(grupo, 0) + 1
        
        # Ejercicios únicos
        ejercicios_unicos = set()
        for doc in docs:
            for ej in doc.get("ejercicios", []):
                ejercicios_unicos.add(ej.get("nombre", ""))
        
        # Fechas únicas
        fechas = set(doc.get("fecha") for doc in docs if doc.get("fecha"))
        
        return {
            "totalEntrenamientos": total_entrenamientos,
            "totalEjercicios": total_ejercicios,
            "ejerciciosUnicos": len(ejercicios_unicos),
            "diasEntrenados": len(fechas),
            "porTipo": por_tipo,
            "porGrupo": por_grupo,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generar-rutina")
def generar_rutina(request: GenerarRutinaRequest):
    """Generar una rutina con OpenAI"""
    try:
        # Obtener entrenamientos recientes para contexto
        docs = list(collection.find({}).sort("fecha", -1).limit(5))
        
        contexto = ""
        if docs:
            contexto = "\nEntrenamientos recientes del usuario:\n"
            for doc in docs:
                contexto += f"\n- {doc.get('nombre', '')} ({doc.get('fecha', '')}):\n"
                for ej in doc.get("ejercicios", [])[:3]:
                    peso = ej.get("peso_kg", "N/A")
                    contexto += f"  * {ej.get('nombre', '')}: {ej.get('series', '')}x{ej.get('repeticiones', '')} @ {peso}\n"

        grupos_texto = (
            f"Grupos musculares: {', '.join(request.grupos_musculares)}"
            if request.grupos_musculares
            else f"Tipo: {request.tipo}"
        )

        prompt = f"""Eres un entrenador personal experto. Genera una rutina de entrenamiento en JSON.

Parámetros:
- {grupos_texto}
- Objetivo: {request.objetivo}
- Nivel: {request.nivel}
- Duración: {request.duracion_minutos} minutos
{f"- Notas: {request.notas}" if request.notas else ""}
{contexto}

Devuelve SOLO JSON válido:
{{
  "id": "fecha-tipo",
  "nombre": "Nombre del entrenamiento",
  "tipo": "{request.tipo}",
  "fecha": "{date.today().isoformat()}",
  "grupos_musculares": ["grupo1", "grupo2"],
  "ejercicios": [
    {{"nombre": "Ejercicio", "series": 4, "repeticiones": 10, "peso_kg": "ajustar"}}
  ]
}}

Incluye 6-8 ejercicios apropiados."""

        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un entrenador experto. Solo respondes con JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000,
        )

        respuesta = completion.choices[0].message.content.strip()
        
        # Limpiar markdown si existe
        if respuesta.startswith("```"):
            respuesta = respuesta.split("```")[1]
            if respuesta.startswith("json"):
                respuesta = respuesta[4:]
        respuesta = respuesta.strip()

        import json
        rutina = json.loads(respuesta)
        rutina["id"] = f"{rutina['fecha']}-{rutina['tipo']}-{ObjectId()}"
        
        # Calcular pesos reales basados en historial
        grupos = rutina.get("grupos_musculares", [])
        for ejercicio in rutina.get("ejercicios", []):
            nombre = ejercicio.get("nombre", "")
            peso_sugerido = obtener_ultimo_peso(nombre, grupos)
            ejercicio["peso_kg"] = peso_sugerido
            print(f"[GENERAR] {nombre} -> {peso_sugerido}")

        return {"rutina": rutina}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================= ENTRENAMIENTO ACTIVO =================

def obtener_ultimo_peso(nombre_ejercicio: str, grupos_musculares: List[str]) -> Union[int, float, str]:
    """Busca el último peso usado para un ejercicio en el historial"""
    
    # Normalizar nombre para búsqueda
    nombre_lower = nombre_ejercicio.lower().strip()
    
    # Extraer palabras clave del ejercicio (ignorar palabras comunes)
    palabras_ignorar = {'de', 'con', 'en', 'la', 'el', 'las', 'los', 'a', 'y', 'o', 'para', 'al'}
    palabras_clave = [p for p in nombre_lower.split() if p not in palabras_ignorar and len(p) > 2]
    
    print(f"[DEBUG] Buscando peso para: {nombre_ejercicio}")
    print(f"[DEBUG] Palabras clave: {palabras_clave}")
    print(f"[DEBUG] Grupos musculares: {grupos_musculares}")
    
    # Buscar en todos los entrenamientos recientes
    historial = list(collection.find({}).sort("fecha", -1).limit(30))
    print(f"[DEBUG] Entrenamientos en historial: {len(historial)}")
    
    mejor_match = None
    mejor_score = 0
    mejor_nombre = ""
    
    for doc in historial:
        for ej in doc.get("ejercicios", []):
            ej_nombre = ej.get("nombre", "").lower()
            
            # Calcular score de coincidencia
            score = 0
            for palabra in palabras_clave:
                if palabra in ej_nombre:
                    score += 1
            
            # Si hay al menos UNA palabra clave que coincide
            if score >= 1:
                peso = ej.get("peso_kg")
                if peso and peso != "ajustar":
                    if score > mejor_score:
                        mejor_score = score
                        mejor_nombre = ej.get("nombre")
                        if isinstance(peso, list):
                            mejor_match = max(peso)
                        else:
                            mejor_match = peso
    
    if mejor_match is not None:
        print(f"[DEBUG] Match encontrado: {mejor_nombre} -> {mejor_match}kg (score: {mejor_score})")
        return mejor_match
    
    # Si no encontró por nombre, buscar promedio por grupo muscular
    print(f"[DEBUG] No match por nombre, buscando por grupo muscular...")
    pesos_grupo = []
    grupos_lower = [g.lower() for g in grupos_musculares]
    
    for doc in historial:
        doc_grupos = [g.lower() for g in doc.get("grupos_musculares", [])]
        # Verificar si hay intersección de grupos
        if any(g in doc_grupos for g in grupos_lower):
            for ej in doc.get("ejercicios", []):
                peso = ej.get("peso_kg")
                if peso and peso != "ajustar":
                    if isinstance(peso, list):
                        pesos_grupo.extend([p for p in peso if isinstance(p, (int, float))])
                    elif isinstance(peso, (int, float)):
                        pesos_grupo.append(peso)
    
    if pesos_grupo:
        promedio = round(sum(pesos_grupo) / len(pesos_grupo), 1)
        print(f"[DEBUG] Promedio grupo muscular: {promedio}kg (de {len(pesos_grupo)} pesos)")
        return promedio
    
    print(f"[DEBUG] No se encontró peso, retornando 'ajustar'")
    return "ajustar"


@app.post("/api/entrenamiento-activo/iniciar")
async def iniciar_entrenamiento(entrenamiento: IniciarEntrenamientoRequest):
    """Iniciar un entrenamiento activo y enviarlo a Matrix"""
    try:
        # Verificar si ya hay un entrenamiento activo
        activo = entrenamiento_activo_collection.find_one({"completado": False})
        if activo:
            raise HTTPException(status_code=400, detail="Ya hay un entrenamiento en curso")
        
        doc = entrenamiento.model_dump()
        doc["inicio"] = datetime.now().isoformat()
        doc["completado"] = False
        
        grupos = doc.get("grupos_musculares", [])
        
        # Convertir ejercicios al formato de seguimiento con pesos del historial
        ejercicios_activos = []
        for ej in doc["ejercicios"]:
            nombre = ej.get("nombre", "")
            
            # Buscar último peso en historial
            peso_historial = obtener_ultimo_peso(nombre, grupos)
            peso_original = ej.get("peso_kg") or ej.get("peso_sugerido", "ajustar")
            
            # Usar peso del historial si existe, sino el original
            if peso_historial != "ajustar":
                peso_final = peso_historial
            elif isinstance(peso_original, (int, float)):
                peso_final = peso_original
            else:
                peso_final = "ajustar"
            
            ejercicio_activo = {
                "nombre": nombre,
                "series_planificadas": ej.get("series") or ej.get("series_planificadas", 4),
                "repeticiones_objetivo": ej.get("repeticiones") or ej.get("repeticiones_objetivo", 10),
                "peso_sugerido": peso_final,
                "series_realizadas": [],
                "completado": False,
                "notas": None
            }
            ejercicios_activos.append(ejercicio_activo)
        
        doc["ejercicios"] = ejercicios_activos
        
        result = entrenamiento_activo_collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        
        # Enviar rutina a Matrix
        mensaje = f"🏋️ ¡Nuevo entrenamiento iniciado!\n\n"
        mensaje += f"📋 {doc['nombre']}\n"
        mensaje += f"📅 {doc['fecha']}\n"
        mensaje += f"💪 Grupos: {', '.join(doc['grupos_musculares'])}\n\n"
        mensaje += "📝 Ejercicios a realizar:\n"
        
        for i, ej in enumerate(ejercicios_activos, 1):
            reps = ej['repeticiones_objetivo']
            if isinstance(reps, list):
                reps = '-'.join(map(str, reps))
            peso = ej['peso_sugerido']
            peso_txt = f"{peso}kg" if isinstance(peso, (int, float)) else peso
            mensaje += f"\n{i}. {ej['nombre']}\n"
            mensaje += f"   → {ej['series_planificadas']} series x {reps} reps @ {peso_txt}\n"
        
        mensaje += "\n¡A darle duro! 💪🔥"
        
        await enviar_mensaje_matrix(mensaje)
        
        return {"success": True, "entrenamiento_activo": doc}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/entrenamiento-activo")
def get_entrenamiento_activo():
    """Obtener el entrenamiento activo actual"""
    try:
        activo = entrenamiento_activo_collection.find_one({"completado": False})
        if not activo:
            return {"activo": False, "entrenamiento": None}
        
        return {"activo": True, "entrenamiento": serialize_doc(activo)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/entrenamiento-activo/recalcular-pesos")
def recalcular_pesos():
    """Recalcular pesos sugeridos basándose en el historial"""
    try:
        activo = entrenamiento_activo_collection.find_one({"completado": False})
        if not activo:
            raise HTTPException(status_code=404, detail="No hay entrenamiento activo")
        
        grupos = activo.get("grupos_musculares", [])
        ejercicios = activo.get("ejercicios", [])
        
        for ej in ejercicios:
            nombre = ej.get("nombre", "")
            peso_actual = ej.get("peso_sugerido")
            
            # Si el peso es "ajustar", recalcular
            if peso_actual == "ajustar" or peso_actual is None:
                nuevo_peso = obtener_ultimo_peso(nombre, grupos)
                ej["peso_sugerido"] = nuevo_peso
        
        entrenamiento_activo_collection.update_one(
            {"_id": activo["_id"]},
            {"$set": {"ejercicios": ejercicios}}
        )
        
        return {"success": True, "entrenamiento": serialize_doc(activo)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/entrenamiento-activo/actualizar-serie")
def actualizar_serie(request: ActualizarEjercicioRequest):
    """Actualizar una serie de un ejercicio"""
    try:
        activo = entrenamiento_activo_collection.find_one({"completado": False})
        if not activo:
            raise HTTPException(status_code=404, detail="No hay entrenamiento activo")
        
        ejercicios = activo.get("ejercicios", [])
        if request.ejercicio_index >= len(ejercicios):
            raise HTTPException(status_code=400, detail="Índice de ejercicio inválido")
        
        serie_dict = request.serie.model_dump()
        ejercicios[request.ejercicio_index]["series_realizadas"].append(serie_dict)
        
        # Marcar como completado si ya se hicieron todas las series
        series_planificadas = ejercicios[request.ejercicio_index].get("series_planificadas", 4)
        if len(ejercicios[request.ejercicio_index]["series_realizadas"]) >= series_planificadas:
            ejercicios[request.ejercicio_index]["completado"] = True
        
        entrenamiento_activo_collection.update_one(
            {"_id": activo["_id"]},
            {"$set": {"ejercicios": ejercicios}}
        )
        
        return {"success": True, "ejercicio": ejercicios[request.ejercicio_index]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/entrenamiento-activo/completar-ejercicio/{ejercicio_index}")
def completar_ejercicio(ejercicio_index: int):
    """Marcar un ejercicio como completado"""
    try:
        activo = entrenamiento_activo_collection.find_one({"completado": False})
        if not activo:
            raise HTTPException(status_code=404, detail="No hay entrenamiento activo")
        
        ejercicios = activo.get("ejercicios", [])
        if ejercicio_index >= len(ejercicios):
            raise HTTPException(status_code=400, detail="Índice de ejercicio inválido")
        
        ejercicios[ejercicio_index]["completado"] = True
        
        entrenamiento_activo_collection.update_one(
            {"_id": activo["_id"]},
            {"$set": {"ejercicios": ejercicios}}
        )
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/entrenamiento-activo/finalizar")
async def finalizar_entrenamiento(request: FinalizarEntrenamientoRequest):
    """Finalizar el entrenamiento activo y guardarlo"""
    try:
        activo = entrenamiento_activo_collection.find_one({"completado": False})
        if not activo:
            raise HTTPException(status_code=404, detail="No hay entrenamiento activo")
        
        fin = datetime.now()
        inicio = datetime.fromisoformat(activo["inicio"]) if activo.get("inicio") else fin
        duracion_minutos = int((fin - inicio).total_seconds() / 60)
        
        # Actualizar como completado
        entrenamiento_activo_collection.update_one(
            {"_id": activo["_id"]},
            {"$set": {"completado": True, "fin": fin.isoformat()}}
        )
        
        # Preparar resumen para guardar en gimnasio
        ejercicios_realizados = []
        resumen_texto = f"🏋️ Entrenamiento completado: {activo['nombre']}\n"
        resumen_texto += f"📅 Fecha: {activo['fecha']}\n"
        resumen_texto += f"⏱️ Duración: {duracion_minutos} minutos\n"
        resumen_texto += f"💪 Grupos: {', '.join(activo['grupos_musculares'])}\n\n"
        resumen_texto += "📋 Ejercicios realizados:\n"
        
        for ej in activo.get("ejercicios", []):
            series = ej.get("series_realizadas", [])
            if series:
                # Calcular promedios
                total_reps = sum(s["repeticiones"] for s in series)
                total_peso = sum(s["peso_kg"] for s in series)
                avg_peso = total_peso / len(series) if series else 0
                max_peso = max(s["peso_kg"] for s in series) if series else 0
                
                ejercicios_realizados.append({
                    "nombre": ej["nombre"],
                    "series": len(series),
                    "repeticiones": [s["repeticiones"] for s in series],
                    "peso_kg": [s["peso_kg"] for s in series]
                })
                
                resumen_texto += f"\n• {ej['nombre']}: {len(series)} series\n"
                for i, s in enumerate(series):
                    resumen_texto += f"  Serie {i+1}: {s['repeticiones']} reps @ {s['peso_kg']}kg\n"
        
        # Guardar en colección gimnasio
        entrenamiento_guardado = {
            "id": f"{activo['fecha']}-{activo['tipo']}-completado-{ObjectId()}",
            "nombre": activo["nombre"],
            "tipo": activo["tipo"],
            "fecha": activo["fecha"],
            "grupos_musculares": activo["grupos_musculares"],
            "ejercicios": ejercicios_realizados,
            "duracion_aprox_min": duracion_minutos,
            "notas": f"Entrenamiento completado. Duración: {duracion_minutos} min"
        }
        
        collection.insert_one(entrenamiento_guardado)
        
        # Enviar a Matrix si está habilitado
        mensaje_matrix = None
        if request.enviar_matrix:
            enviado = await enviar_mensaje_matrix(resumen_texto)
            mensaje_matrix = "Enviado a Matrix" if enviado else "No se pudo enviar a Matrix"
        
        return {
            "success": True,
            "duracion_minutos": duracion_minutos,
            "ejercicios_completados": len([e for e in activo["ejercicios"] if e.get("completado")]),
            "total_ejercicios": len(activo["ejercicios"]),
            "resumen": resumen_texto,
            "matrix": mensaje_matrix
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/entrenamiento-activo/cancelar")
def cancelar_entrenamiento():
    """Cancelar el entrenamiento activo"""
    try:
        result = entrenamiento_activo_collection.delete_many({"completado": False})
        return {"success": True, "eliminados": result.deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================= EQUIPAMIENTO =================

@app.get("/api/equipamiento")
def get_equipamiento():
    """Obtener todo el equipamiento disponible"""
    try:
        docs = list(equipamiento_collection.find({}))
        return [serialize_doc(doc) for doc in docs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/equipamiento")
def crear_equipamiento(equipamiento: Equipamiento):
    """Agregar equipamiento al gimnasio"""
    try:
        doc = equipamiento.model_dump()
        result = equipamiento_collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return {"success": True, "equipamiento": doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/equipamiento/inicializar")
def inicializar_equipamiento():
    """Inicializar equipamiento básico de gimnasio"""
    try:
        equipamiento_basico = [
            {"nombre": "Press de banca", "tipo": "peso_libre", "grupo_muscular_principal": ["pecho", "triceps"], "ejercicios_posibles": ["Press de banca", "Press inclinado", "Press declinado"]},
            {"nombre": "Rack de sentadillas", "tipo": "peso_libre", "grupo_muscular_principal": ["piernas", "gluteos"], "ejercicios_posibles": ["Sentadilla", "Sentadilla frontal", "Good morning"]},
            {"nombre": "Máquina de poleas", "tipo": "cable", "grupo_muscular_principal": ["espalda", "biceps", "triceps", "hombros"], "ejercicios_posibles": ["Jalón al pecho", "Remo en polea", "Triceps en polea", "Face pull", "Curl en polea"]},
            {"nombre": "Press de hombros", "tipo": "maquina", "grupo_muscular_principal": ["hombros"], "ejercicios_posibles": ["Press militar sentado"]},
            {"nombre": "Prensa de piernas", "tipo": "maquina", "grupo_muscular_principal": ["piernas"], "ejercicios_posibles": ["Prensa de piernas", "Prensa a una pierna"]},
            {"nombre": "Extensión de cuádriceps", "tipo": "maquina", "grupo_muscular_principal": ["piernas"], "ejercicios_posibles": ["Extensión de cuádriceps"]},
            {"nombre": "Curl de piernas", "tipo": "maquina", "grupo_muscular_principal": ["piernas"], "ejercicios_posibles": ["Curl femoral sentado", "Curl femoral acostado"]},
            {"nombre": "Pec deck / Aperturas", "tipo": "maquina", "grupo_muscular_principal": ["pecho"], "ejercicios_posibles": ["Aperturas en máquina", "Pec deck"]},
            {"nombre": "Remo en máquina", "tipo": "maquina", "grupo_muscular_principal": ["espalda"], "ejercicios_posibles": ["Remo sentado en máquina"]},
            {"nombre": "Mancuernas", "tipo": "peso_libre", "grupo_muscular_principal": ["todos"], "ejercicios_posibles": ["Curl de bíceps", "Press con mancuernas", "Elevaciones laterales", "Remo con mancuerna", "Extensión de tríceps"]},
            {"nombre": "Barra olímpica", "tipo": "peso_libre", "grupo_muscular_principal": ["todos"], "ejercicios_posibles": ["Peso muerto", "Remo con barra", "Curl con barra", "Press militar"]},
            {"nombre": "Pull-up bar", "tipo": "peso_libre", "grupo_muscular_principal": ["espalda", "biceps"], "ejercicios_posibles": ["Dominadas", "Chin-ups"]},
        ]
        
        # Limpiar y reinsertar
        equipamiento_collection.delete_many({})
        result = equipamiento_collection.insert_many(equipamiento_basico)
        
        return {"success": True, "insertados": len(result.inserted_ids)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================= TEST MATRIX =================

@app.post("/api/test-matrix")
async def test_matrix():
    """Probar envío a Matrix"""
    try:
        mensaje = "🧪 Test desde Trener App - Conexión exitosa!"
        enviado = await enviar_mensaje_matrix(mensaje)
        return {"success": enviado, "mensaje": "Enviado" if enviado else "Error al enviar"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================= BOT CONVERSACIONAL =================

class BotQueryRequest(BaseModel):
    mensaje: str
    sender: Optional[str] = None


def calcular_racha() -> dict:
    """Calcula la racha actual de entrenamientos"""
    docs = list(collection.find({}).sort("fecha", -1).limit(60))
    if not docs:
        return {"racha_actual": 0, "mejor_racha": 0}
    
    fechas = sorted(set(doc.get("fecha") for doc in docs if doc.get("fecha")), reverse=True)
    
    racha_actual = 0
    hoy = date.today()
    
    for i, fecha_str in enumerate(fechas):
        try:
            fecha = datetime.strptime(fecha_str, "%Y-%m-%d").date()
            dias_diff = (hoy - fecha).days
            
            # Permitir gap de 1-2 días entre entrenamientos
            if i == 0 and dias_diff <= 2:
                racha_actual = 1
            elif i > 0:
                fecha_anterior = datetime.strptime(fechas[i-1], "%Y-%m-%d").date()
                gap = (fecha_anterior - fecha).days
                if gap <= 3:  # Max 3 días entre entrenamientos
                    racha_actual += 1
                else:
                    break
            else:
                break
        except:
            continue
    
    return {"racha_actual": racha_actual, "mejor_racha": racha_actual}  # TODO: guardar mejor racha


def obtener_prs() -> List[dict]:
    """Obtiene los récords personales de peso por ejercicio"""
    docs = list(collection.find({}))
    prs = {}
    
    for doc in docs:
        for ej in doc.get("ejercicios", []):
            nombre = ej.get("nombre", "").lower()
            peso = ej.get("peso_kg")
            
            if peso and peso != "ajustar":
                if isinstance(peso, list):
                    peso_max = max(p for p in peso if isinstance(p, (int, float)))
                elif isinstance(peso, (int, float)):
                    peso_max = peso
                else:
                    continue
                
                if nombre not in prs or peso_max > prs[nombre]["peso"]:
                    prs[nombre] = {
                        "ejercicio": ej.get("nombre"),
                        "peso": peso_max,
                        "fecha": doc.get("fecha")
                    }
    
    return sorted(prs.values(), key=lambda x: x["peso"], reverse=True)[:10]


def resumen_semana() -> dict:
    """Resumen de la semana actual"""
    hoy = date.today()
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    
    docs = list(collection.find({
        "fecha": {"$gte": inicio_semana.isoformat()}
    }))
    
    total_entrenamientos = len(docs)
    grupos_trabajados = set()
    total_series = 0
    
    for doc in docs:
        grupos_trabajados.update(doc.get("grupos_musculares", []))
        for ej in doc.get("ejercicios", []):
            total_series += ej.get("series", 0)
    
    return {
        "entrenamientos": total_entrenamientos,
        "grupos_trabajados": list(grupos_trabajados),
        "total_series": total_series,
        "dias_restantes": 7 - hoy.weekday()
    }


@app.post("/api/bot/query")
async def bot_query(request: BotQueryRequest):
    """Endpoint para que el bot consulte datos de forma conversacional"""
    try:
        mensaje = request.mensaje.lower()
        
        # Detectar intención del mensaje
        if any(word in mensaje for word in ["semana", "esta semana", "semanal"]):
            resumen = resumen_semana()
            respuesta = f"📊 **Resumen de la semana:**\n"
            respuesta += f"• Entrenamientos: {resumen['entrenamientos']}\n"
            respuesta += f"• Grupos trabajados: {', '.join(resumen['grupos_trabajados']) or 'Ninguno aún'}\n"
            respuesta += f"• Total series: {resumen['total_series']}\n"
            respuesta += f"• Días restantes: {resumen['dias_restantes']}"
            return {"respuesta": respuesta, "tipo": "resumen_semana", "data": resumen}
        
        elif any(word in mensaje for word in ["racha", "streak", "consecutivo"]):
            racha = calcular_racha()
            if racha["racha_actual"] > 0:
                respuesta = f"🔥 ¡Llevas una racha de **{racha['racha_actual']} entrenamientos**! Sigue así 💪"
            else:
                respuesta = "😴 No tienes racha activa. ¡Es hora de entrenar!"
            return {"respuesta": respuesta, "tipo": "racha", "data": racha}
        
        elif any(word in mensaje for word in ["pr", "record", "récord", "mejor", "máximo"]):
            prs = obtener_prs()
            if prs:
                respuesta = "🏆 **Tus mejores marcas:**\n"
                for i, pr in enumerate(prs[:5], 1):
                    respuesta += f"{i}. {pr['ejercicio']}: **{pr['peso']}kg** ({pr['fecha']})\n"
            else:
                respuesta = "No tengo registros de pesos aún."
            return {"respuesta": respuesta, "tipo": "prs", "data": prs}
        
        elif any(word in mensaje for word in ["último", "ultimo", "reciente", "hoy", "ayer"]):
            doc = collection.find_one({}, sort=[("fecha", -1)])
            if doc:
                respuesta = f"📋 **Último entrenamiento:** {doc.get('nombre')}\n"
                respuesta += f"📅 Fecha: {doc.get('fecha')}\n"
                respuesta += f"💪 Grupos: {', '.join(doc.get('grupos_musculares', []))}\n"
                respuesta += f"📝 Ejercicios: {len(doc.get('ejercicios', []))}"
            else:
                respuesta = "No encontré entrenamientos registrados."
            return {"respuesta": respuesta, "tipo": "ultimo", "data": serialize_doc(doc) if doc else None}
        
        elif any(word in mensaje for word in ["estadística", "estadisticas", "stats", "total"]):
            stats = get_estadisticas()
            respuesta = f"📈 **Estadísticas generales:**\n"
            respuesta += f"• Total entrenamientos: {stats['totalEntrenamientos']}\n"
            respuesta += f"• Ejercicios únicos: {stats['ejerciciosUnicos']}\n"
            respuesta += f"• Días entrenados: {stats['diasEntrenados']}"
            return {"respuesta": respuesta, "tipo": "estadisticas", "data": stats}
        
        elif any(word in mensaje for word in ["generar", "genera", "rutina", "crear"]):
            # Detectar tipo de entrenamiento
            tipo = "full"
            if "push" in mensaje or "pecho" in mensaje:
                tipo = "push"
            elif "pull" in mensaje or "espalda" in mensaje:
                tipo = "pull"
            elif "pierna" in mensaje or "leg" in mensaje:
                tipo = "legs"
            
            respuesta = f"💡 Para generar una rutina de **{tipo}**, ve a:\n"
            respuesta += f"🔗 http://localhost:3001/generar\n\n"
            respuesta += f"O dime más detalles: objetivo, duración, nivel..."
            return {"respuesta": respuesta, "tipo": "generar", "data": {"tipo_sugerido": tipo}}
        
        elif any(word in mensaje for word in ["logro", "badge", "nivel", "gamificacion"]):
            logros = obtener_logros_usuario()
            respuesta = f"🎮 **Tu perfil:**\n"
            respuesta += f"• Nivel: {logros['nivel']} ({logros['titulo']})\n"
            respuesta += f"• XP: {logros['xp']}/{logros['xp_siguiente_nivel']}\n"
            respuesta += f"• Logros: {len(logros['logros_desbloqueados'])}/{logros['total_logros']}\n"
            if logros['logros_desbloqueados']:
                respuesta += f"🏅 Últimos: {', '.join(logros['logros_desbloqueados'][-3:])}"
            return {"respuesta": respuesta, "tipo": "logros", "data": logros}
        
        else:
            # Respuesta por defecto con sugerencias
            respuesta = "🤖 Puedo ayudarte con:\n"
            respuesta += "• *\"¿Qué entrené esta semana?\"*\n"
            respuesta += "• *\"¿Cuál es mi racha?\"*\n"
            respuesta += "• *\"Mis récords personales\"*\n"
            respuesta += "• *\"Último entrenamiento\"*\n"
            respuesta += "• *\"Mis estadísticas\"*\n"
            respuesta += "• *\"Mis logros\"*\n"
            respuesta += "• *\"Genera una rutina de push\"*"
            return {"respuesta": respuesta, "tipo": "ayuda", "data": None}
    
    except Exception as e:
        return {"respuesta": f"Error: {str(e)}", "tipo": "error", "data": None}


# ================= GAMIFICACIÓN =================

LOGROS_DEFINIDOS = [
    {"id": "primer_entrenamiento", "nombre": "🏋️ Primer Paso", "descripcion": "Registra tu primer entrenamiento", "xp": 50, "condicion": lambda stats: stats["total"] >= 1},
    {"id": "5_entrenamientos", "nombre": "💪 Constante", "descripcion": "Completa 5 entrenamientos", "xp": 100, "condicion": lambda stats: stats["total"] >= 5},
    {"id": "10_entrenamientos", "nombre": "🔥 En Racha", "descripcion": "Completa 10 entrenamientos", "xp": 200, "condicion": lambda stats: stats["total"] >= 10},
    {"id": "25_entrenamientos", "nombre": "⭐ Dedicado", "descripcion": "Completa 25 entrenamientos", "xp": 500, "condicion": lambda stats: stats["total"] >= 25},
    {"id": "50_entrenamientos", "nombre": "🏆 Veterano", "descripcion": "Completa 50 entrenamientos", "xp": 1000, "condicion": lambda stats: stats["total"] >= 50},
    {"id": "racha_3", "nombre": "📅 Semana Activa", "descripcion": "Racha de 3 entrenamientos", "xp": 75, "condicion": lambda stats: stats["racha"] >= 3},
    {"id": "racha_7", "nombre": "🗓️ Semana Perfecta", "descripcion": "Racha de 7 entrenamientos", "xp": 200, "condicion": lambda stats: stats["racha"] >= 7},
    {"id": "racha_14", "nombre": "🌟 Dos Semanas", "descripcion": "Racha de 14 entrenamientos", "xp": 500, "condicion": lambda stats: stats["racha"] >= 14},
    {"id": "todos_grupos", "nombre": "🎯 Completo", "descripcion": "Entrena todos los grupos musculares", "xp": 150, "condicion": lambda stats: stats["grupos_unicos"] >= 6},
    {"id": "100_series", "nombre": "💯 Centenario", "descripcion": "Completa 100 series en total", "xp": 100, "condicion": lambda stats: stats["total_series"] >= 100},
    {"id": "500_series", "nombre": "🦾 Máquina", "descripcion": "Completa 500 series en total", "xp": 300, "condicion": lambda stats: stats["total_series"] >= 500},
    {"id": "pr_60kg", "nombre": "🏋️ Fuerza Básica", "descripcion": "Levanta 60kg en algún ejercicio", "xp": 100, "condicion": lambda stats: stats["max_peso"] >= 60},
    {"id": "pr_100kg", "nombre": "💪 Club de los 100", "descripcion": "Levanta 100kg en algún ejercicio", "xp": 300, "condicion": lambda stats: stats["max_peso"] >= 100},
]

NIVELES = [
    {"nivel": 1, "titulo": "Novato", "xp_requerido": 0},
    {"nivel": 2, "titulo": "Principiante", "xp_requerido": 100},
    {"nivel": 3, "titulo": "Aprendiz", "xp_requerido": 300},
    {"nivel": 4, "titulo": "Intermedio", "xp_requerido": 600},
    {"nivel": 5, "titulo": "Dedicado", "xp_requerido": 1000},
    {"nivel": 6, "titulo": "Avanzado", "xp_requerido": 1500},
    {"nivel": 7, "titulo": "Experto", "xp_requerido": 2200},
    {"nivel": 8, "titulo": "Maestro", "xp_requerido": 3000},
    {"nivel": 9, "titulo": "Élite", "xp_requerido": 4000},
    {"nivel": 10, "titulo": "Leyenda", "xp_requerido": 5500},
]


def calcular_stats_para_logros() -> dict:
    """Calcula estadísticas necesarias para verificar logros"""
    docs = list(collection.find({}))
    
    total = len(docs)
    racha_data = calcular_racha()
    grupos = set()
    total_series = 0
    max_peso = 0
    
    for doc in docs:
        grupos.update(doc.get("grupos_musculares", []))
        for ej in doc.get("ejercicios", []):
            total_series += ej.get("series", 0)
            peso = ej.get("peso_kg")
            if peso and peso != "ajustar":
                if isinstance(peso, list):
                    max_peso = max(max_peso, max(p for p in peso if isinstance(p, (int, float))))
                elif isinstance(peso, (int, float)):
                    max_peso = max(max_peso, peso)
    
    return {
        "total": total,
        "racha": racha_data["racha_actual"],
        "grupos_unicos": len(grupos),
        "total_series": total_series,
        "max_peso": max_peso
    }


def obtener_logros_usuario() -> dict:
    """Obtiene el estado de logros del usuario"""
    # Obtener o crear perfil de usuario
    usuario = usuario_collection.find_one({"user_id": "default"})
    if not usuario:
        usuario = {
            "user_id": "default",
            "xp": 0,
            "logros_desbloqueados": [],
            "created_at": datetime.now().isoformat()
        }
        usuario_collection.insert_one(usuario)
    
    stats = calcular_stats_para_logros()
    logros_actuales = usuario.get("logros_desbloqueados", [])
    xp_total = usuario.get("xp", 0)
    nuevos_logros = []
    
    # Verificar logros nuevos
    for logro in LOGROS_DEFINIDOS:
        if logro["id"] not in logros_actuales:
            if logro["condicion"](stats):
                logros_actuales.append(logro["id"])
                xp_total += logro["xp"]
                nuevos_logros.append(logro)
    
    # Actualizar en BD si hay cambios
    if nuevos_logros:
        usuario_collection.update_one(
            {"user_id": "default"},
            {"$set": {"logros_desbloqueados": logros_actuales, "xp": xp_total}}
        )
    
    # Calcular nivel
    nivel_actual = NIVELES[0]
    xp_siguiente = NIVELES[1]["xp_requerido"] if len(NIVELES) > 1 else 9999
    
    for i, nivel in enumerate(NIVELES):
        if xp_total >= nivel["xp_requerido"]:
            nivel_actual = nivel
            if i + 1 < len(NIVELES):
                xp_siguiente = NIVELES[i + 1]["xp_requerido"]
    
    return {
        "nivel": nivel_actual["nivel"],
        "titulo": nivel_actual["titulo"],
        "xp": xp_total,
        "xp_siguiente_nivel": xp_siguiente,
        "logros_desbloqueados": logros_actuales,
        "total_logros": len(LOGROS_DEFINIDOS),
        "nuevos_logros": [{"nombre": l["nombre"], "descripcion": l["descripcion"], "xp": l["xp"]} for l in nuevos_logros]
    }


@app.get("/api/gamificacion/perfil")
def get_perfil_gamificacion():
    """Obtener perfil de gamificación del usuario"""
    try:
        return obtener_logros_usuario()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gamificacion/logros")
def get_todos_logros():
    """Obtener lista de todos los logros disponibles"""
    try:
        usuario = obtener_logros_usuario()
        logros_desbloqueados = usuario["logros_desbloqueados"]
        
        logros = []
        for logro in LOGROS_DEFINIDOS:
            logros.append({
                "id": logro["id"],
                "nombre": logro["nombre"],
                "descripcion": logro["descripcion"],
                "xp": logro["xp"],
                "desbloqueado": logro["id"] in logros_desbloqueados
            })
        
        return {"logros": logros}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================= PROGRESO Y GRÁFICAS =================

@app.get("/api/progreso/ejercicio/{nombre_ejercicio}")
def get_progreso_ejercicio(nombre_ejercicio: str):
    """Obtener historial de pesos para un ejercicio específico"""
    try:
        docs = list(collection.find({}).sort("fecha", 1))
        
        progreso = []
        nombre_lower = nombre_ejercicio.lower()
        
        for doc in docs:
            for ej in doc.get("ejercicios", []):
                if nombre_lower in ej.get("nombre", "").lower():
                    peso = ej.get("peso_kg")
                    if peso and peso != "ajustar":
                        if isinstance(peso, list):
                            peso_max = max(p for p in peso if isinstance(p, (int, float)))
                        elif isinstance(peso, (int, float)):
                            peso_max = peso
                        else:
                            continue
                        
                        progreso.append({
                            "fecha": doc.get("fecha"),
                            "peso": peso_max,
                            "series": ej.get("series"),
                            "repeticiones": ej.get("repeticiones")
                        })
        
        return {"ejercicio": nombre_ejercicio, "progreso": progreso}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/progreso/volumen")
def get_progreso_volumen():
    """Obtener volumen total por semana"""
    try:
        docs = list(collection.find({}).sort("fecha", 1))
        print(f"[VOLUMEN] Documentos encontrados: {len(docs)}")
        
        volumen_por_semana = {}
        
        for doc in docs:
            fecha_str = doc.get("fecha")
            if not fecha_str:
                continue
            
            try:
                fecha = datetime.strptime(fecha_str, "%Y-%m-%d")
                # Obtener inicio de semana (lunes)
                inicio_semana = fecha - timedelta(days=fecha.weekday())
                semana_key = inicio_semana.strftime("%Y-%m-%d")
                
                if semana_key not in volumen_por_semana:
                    volumen_por_semana[semana_key] = {"series": 0, "ejercicios": 0, "entrenamientos": 0}
                
                volumen_por_semana[semana_key]["entrenamientos"] += 1
                
                for ej in doc.get("ejercicios", []):
                    series = ej.get("series", 0)
                    if isinstance(series, (int, float)):
                        volumen_por_semana[semana_key]["series"] += int(series)
                    volumen_por_semana[semana_key]["ejercicios"] += 1
            except Exception as inner_e:
                print(f"[VOLUMEN] Error procesando doc {fecha_str}: {inner_e}")
                continue
        
        # Convertir a lista ordenada
        resultado = [
            {"semana": k, **v}
            for k, v in sorted(volumen_por_semana.items())
        ]
        
        print(f"[VOLUMEN] Resultado: {len(resultado)} semanas")
        return {"volumen_semanal": resultado}
    except Exception as e:
        print(f"[VOLUMEN] Error general: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/progreso/grupos")
def get_progreso_grupos():
    """Obtener distribución de entrenamientos por grupo muscular"""
    try:
        docs = list(collection.find({}))
        
        por_grupo = {}
        
        for doc in docs:
            for grupo in doc.get("grupos_musculares", []):
                grupo_lower = grupo.lower()
                if grupo_lower not in por_grupo:
                    por_grupo[grupo_lower] = {"entrenamientos": 0, "series": 0}
                
                por_grupo[grupo_lower]["entrenamientos"] += 1
                
                for ej in doc.get("ejercicios", []):
                    por_grupo[grupo_lower]["series"] += ej.get("series", 0)
        
        return {"por_grupo": por_grupo}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/progreso/ejercicios-frecuentes")
def get_ejercicios_frecuentes():
    """Obtener los ejercicios más frecuentes con sus stats"""
    try:
        docs = list(collection.find({}))
        
        ejercicios = {}
        
        for doc in docs:
            for ej in doc.get("ejercicios", []):
                nombre = ej.get("nombre", "")
                if not nombre:
                    continue
                
                if nombre not in ejercicios:
                    ejercicios[nombre] = {
                        "nombre": nombre,
                        "veces": 0,
                        "pesos": [],
                        "ultimo_peso": None,
                        "max_peso": 0
                    }
                
                ejercicios[nombre]["veces"] += 1
                
                peso = ej.get("peso_kg")
                if peso and peso != "ajustar":
                    if isinstance(peso, list):
                        peso_val = max(p for p in peso if isinstance(p, (int, float)))
                    elif isinstance(peso, (int, float)):
                        peso_val = peso
                    else:
                        continue
                    
                    ejercicios[nombre]["pesos"].append(peso_val)
                    ejercicios[nombre]["ultimo_peso"] = peso_val
                    ejercicios[nombre]["max_peso"] = max(ejercicios[nombre]["max_peso"], peso_val)
        
        # Ordenar por frecuencia y limpiar
        resultado = sorted(ejercicios.values(), key=lambda x: x["veces"], reverse=True)[:20]
        for ej in resultado:
            if ej["pesos"]:
                ej["promedio_peso"] = round(sum(ej["pesos"]) / len(ej["pesos"]), 1)
            del ej["pesos"]
        
        return {"ejercicios": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================= MÉTRICAS AVANZADAS =================

def calcular_1rm(peso: float, repeticiones: int) -> float:
    """Calcula el 1RM usando la fórmula de Brzycki"""
    if repeticiones <= 0 or peso <= 0:
        return 0
    if repeticiones == 1:
        return peso
    return round(peso * (36 / (37 - repeticiones)), 1)


@app.get("/api/metricas/1rm")
def get_todos_1rm():
    """Obtener 1RM estimado para todos los ejercicios principales"""
    try:
        docs = list(collection.find({}).sort("fecha", -1))
        
        ejercicios_1rm = {}
        
        for doc in docs:
            for ej in doc.get("ejercicios", []):
                nombre = ej.get("nombre", "")
                peso = ej.get("peso_kg")
                reps = ej.get("repeticiones")
                
                if not nombre or not peso or peso == "ajustar":
                    continue
                
                # Normalizar peso y reps
                if isinstance(peso, list):
                    peso = max(p for p in peso if isinstance(p, (int, float)))
                if isinstance(reps, list):
                    reps = min(reps)  # Usar el menor para ser conservador
                if not isinstance(reps, int) or reps > 12:
                    continue  # 1RM solo es preciso con menos de 12 reps
                
                rm = calcular_1rm(peso, reps)
                
                if nombre not in ejercicios_1rm or rm > ejercicios_1rm[nombre]["rm"]:
                    ejercicios_1rm[nombre] = {
                        "ejercicio": nombre,
                        "rm": rm,
                        "peso_usado": peso,
                        "reps": reps,
                        "fecha": doc.get("fecha")
                    }
        
        resultado = sorted(ejercicios_1rm.values(), key=lambda x: x["rm"], reverse=True)
        return {"ejercicios": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metricas/comparativa-semanal")
def get_comparativa_semanal():
    """Comparar esta semana vs semana pasada"""
    try:
        hoy = date.today()
        inicio_esta_semana = hoy - timedelta(days=hoy.weekday())
        inicio_semana_pasada = inicio_esta_semana - timedelta(days=7)
        
        docs = list(collection.find({
            "fecha": {"$gte": inicio_semana_pasada.isoformat()}
        }))
        
        esta_semana = {"entrenamientos": 0, "series": 0, "volumen": 0}
        semana_pasada = {"entrenamientos": 0, "series": 0, "volumen": 0}
        
        for doc in docs:
            fecha = doc.get("fecha", "")
            datos = esta_semana if fecha >= inicio_esta_semana.isoformat() else semana_pasada
            
            datos["entrenamientos"] += 1
            for ej in doc.get("ejercicios", []):
                series = ej.get("series", 0)
                datos["series"] += series
                peso = ej.get("peso_kg")
                if peso and peso != "ajustar":
                    if isinstance(peso, list):
                        peso = sum(peso) / len(peso)
                    reps = ej.get("repeticiones", 10)
                    if isinstance(reps, list):
                        reps = sum(reps) / len(reps)
                    datos["volumen"] += series * reps * peso
        
        # Calcular porcentajes de cambio
        def calcular_cambio(actual, anterior):
            if anterior == 0:
                return 100 if actual > 0 else 0
            return round(((actual - anterior) / anterior) * 100, 1)
        
        return {
            "esta_semana": esta_semana,
            "semana_pasada": semana_pasada,
            "cambio": {
                "entrenamientos": calcular_cambio(esta_semana["entrenamientos"], semana_pasada["entrenamientos"]),
                "series": calcular_cambio(esta_semana["series"], semana_pasada["series"]),
                "volumen": calcular_cambio(esta_semana["volumen"], semana_pasada["volumen"])
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metricas/resumen-inteligente")
async def get_resumen_inteligente():
    """Genera un resumen inteligente con insights usando AI"""
    try:
        # Recopilar datos
        stats = get_estadisticas()
        racha = calcular_racha()
        semana = resumen_semana()
        comparativa = get_comparativa_semanal()
        prs = obtener_prs()[:5]
        logros = obtener_logros_usuario()
        
        # Construir contexto para AI
        contexto = f"""
Datos del usuario de gimnasio:
- Total entrenamientos: {stats['totalEntrenamientos']}
- Días entrenados: {stats['diasEntrenados']}
- Racha actual: {racha['racha_actual']} entrenamientos consecutivos
- Esta semana: {semana['entrenamientos']} entrenamientos, {semana['total_series']} series
- Grupos trabajados esta semana: {', '.join(semana['grupos_trabajados']) or 'ninguno'}
- Cambio vs semana pasada: {comparativa['cambio']['entrenamientos']}% entrenamientos, {comparativa['cambio']['volumen']}% volumen
- Nivel: {logros['nivel']} ({logros['titulo']})
- XP: {logros['xp']}
- PRs recientes: {', '.join([f"{p['ejercicio']}: {p['peso']}kg" for p in prs]) if prs else 'ninguno'}
"""
        
        prompt = f"""Eres un coach de fitness amigable. Basado en estos datos, da un resumen breve (3-4 líneas máximo) 
con un insight motivacional y una sugerencia práctica. Usa emojis. Sé directo y personal.

{contexto}

Responde en español de forma natural y motivadora:"""

        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un coach de fitness amigable y motivador. Respuestas cortas y directas."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=200,
        )
        
        resumen_ai = completion.choices[0].message.content.strip()
        
        return {
            "resumen_ai": resumen_ai,
            "stats": stats,
            "racha": racha,
            "semana": semana,
            "comparativa": comparativa,
            "nivel": {"nivel": logros["nivel"], "titulo": logros["titulo"], "xp": logros["xp"]}
        }
    except Exception as e:
        return {
            "resumen_ai": "💪 ¡Sigue entrenando! Estoy recopilando datos para darte mejores insights.",
            "error": str(e)
        }


# ================= CHAT AI INTELIGENTE =================

class ChatRequest(BaseModel):
    mensaje: str
    contexto: Optional[List[dict]] = None


@app.post("/api/chat")
async def chat_inteligente(request: ChatRequest):
    """Chat conversacional inteligente con contexto del usuario"""
    try:
        # Obtener contexto del usuario
        stats = get_estadisticas()
        racha = calcular_racha()
        semana = resumen_semana()
        ultimo = collection.find_one({}, sort=[("fecha", -1)])
        prs = obtener_prs()[:5]
        logros = obtener_logros_usuario()
        
        contexto_usuario = f"""
DATOS DEL USUARIO:
- Total entrenamientos: {stats['totalEntrenamientos']}
- Racha actual: {racha['racha_actual']}
- Esta semana: {semana['entrenamientos']} entrenamientos
- Grupos trabajados esta semana: {', '.join(semana['grupos_trabajados']) or 'ninguno'}
- Nivel: {logros['nivel']} - {logros['titulo']}
- Último entrenamiento: {ultimo.get('nombre') if ultimo else 'ninguno'} ({ultimo.get('fecha') if ultimo else 'N/A'})
- PRs: {', '.join([f"{p['ejercicio']}: {p['peso']}kg" for p in prs]) if prs else 'ninguno'}
"""
        
        mensaje_lower = request.mensaje.lower()
        
        # Detectar si quiere generar rutina
        if any(word in mensaje_lower for word in ["genera", "generar", "crea", "crear", "hazme", "dame"]) and \
           any(word in mensaje_lower for word in ["rutina", "entrenamiento", "workout"]):
            
            # Extraer parámetros del mensaje
            tipo = "full"
            if any(w in mensaje_lower for w in ["push", "pecho", "empuje"]):
                tipo = "push"
            elif any(w in mensaje_lower for w in ["pull", "espalda", "tirón", "jalon"]):
                tipo = "pull"
            elif any(w in mensaje_lower for w in ["pierna", "legs", "leg day"]):
                tipo = "legs"
            elif any(w in mensaje_lower for w in ["hombro", "shoulder"]):
                tipo = "hombro"
            
            duracion = 45
            if "30" in mensaje_lower or "media hora" in mensaje_lower:
                duracion = 30
            elif "60" in mensaje_lower or "una hora" in mensaje_lower or "1 hora" in mensaje_lower:
                duracion = 60
            
            nivel = "intermedio"
            if any(w in mensaje_lower for w in ["principiante", "básico", "inicio"]):
                nivel = "principiante"
            elif any(w in mensaje_lower for w in ["avanzado", "difícil", "intenso"]):
                nivel = "avanzado"
            
            # Generar rutina
            rutina_request = GenerarRutinaRequest(
                tipo=tipo,
                objetivo="hipertrofia",
                duracion_minutos=duracion,
                nivel=nivel
            )
            
            resultado = await generar_rutina(rutina_request)
            rutina = resultado["rutina"]
            
            # Formatear respuesta
            ejercicios_texto = "\n".join([
                f"  • {ej['nombre']}: {ej['series']}x{ej['repeticiones']} @ {ej['peso_kg']}kg"
                for ej in rutina["ejercicios"]
            ])
            
            respuesta = f"""🏋️ **{rutina['nombre']}**

📋 **Ejercicios:**
{ejercicios_texto}

💡 Los pesos están basados en tu historial. ¿Quieres que la inicie o la modifico?"""

            return {
                "respuesta": respuesta,
                "tipo": "rutina_generada",
                "rutina": rutina,
                "accion_sugerida": "iniciar_entrenamiento"
            }
        
        # Chat general con AI
        system_prompt = f"""Eres el asistente de entrenamiento personal de Trener. Tu nombre es Trener AI.
Eres experto en fitness, nutrición y entrenamiento de fuerza.
Responde de forma amigable, usa emojis ocasionalmente, y sé conciso.
Si el usuario pregunta sobre generar rutinas, sugiere que te diga qué tipo de entrenamiento quiere.

{contexto_usuario}

CAPACIDADES:
- Puedes generar rutinas personalizadas
- Tienes acceso al historial de entrenamientos
- Puedes ver racha, PRs, estadísticas
- Puedes dar consejos de entrenamiento

Responde en español."""

        messages = [{"role": "system", "content": system_prompt}]
        
        # Agregar historial de conversación si existe
        if request.contexto:
            messages.extend(request.contexto[-6:])  # Últimos 6 mensajes
        
        messages.append({"role": "user", "content": request.mensaje})
        
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=500,
        )
        
        respuesta = completion.choices[0].message.content.strip()
        
        return {
            "respuesta": respuesta,
            "tipo": "chat",
            "contexto_actualizado": messages[-6:]  # Devolver últimos mensajes para mantener contexto
        }
        
    except Exception as e:
        return {
            "respuesta": f"Ups, algo salió mal. ¿Puedes reformular tu pregunta? 🤔",
            "tipo": "error",
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
