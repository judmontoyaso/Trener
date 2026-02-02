"""
MCP Server para MongoDB - Trener
Permite al agente/bot interactuar directamente con la base de datos
"""

import os
import json
from datetime import datetime, timedelta
from typing import Any, Optional
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from bson.json_util import dumps, loads

load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["n8n_memoria"]


class JSONEncoder(json.JSONEncoder):
    """Custom encoder para ObjectId y datetime"""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def serialize(data: Any) -> str:
    """Serializa datos de MongoDB a JSON"""
    return json.dumps(data, cls=JSONEncoder, ensure_ascii=False, indent=2)


# ==================== HERRAMIENTAS MCP ====================

def listar_entrenamientos(
    limite: int = 10,
    tipo: Optional[str] = None,
    desde_fecha: Optional[str] = None,
    hasta_fecha: Optional[str] = None
) -> dict:
    """
    Lista entrenamientos con filtros opcionales.
    
    Args:
        limite: Número máximo de resultados (default 10)
        tipo: Filtrar por tipo (push, pull, legs, etc.)
        desde_fecha: Fecha inicio (YYYY-MM-DD)
        hasta_fecha: Fecha fin (YYYY-MM-DD)
    
    Returns:
        Lista de entrenamientos
    """
    filtro = {}
    
    if tipo:
        filtro["tipo"] = tipo.lower()
    
    if desde_fecha or hasta_fecha:
        filtro["fecha"] = {}
        if desde_fecha:
            filtro["fecha"]["$gte"] = desde_fecha
        if hasta_fecha:
            filtro["fecha"]["$lte"] = hasta_fecha
    
    docs = list(db.gimnasio.find(filtro).sort("fecha", -1).limit(limite))
    
    return {
        "total": len(docs),
        "entrenamientos": json.loads(dumps(docs))
    }


def buscar_ejercicio(nombre: str, limite: int = 20) -> dict:
    """
    Busca un ejercicio específico en todo el historial.
    
    Args:
        nombre: Nombre del ejercicio (búsqueda parcial)
        limite: Máximo de resultados
    
    Returns:
        Historial del ejercicio con pesos y fechas
    """
    pipeline = [
        {"$unwind": "$ejercicios"},
        {"$match": {"ejercicios.nombre": {"$regex": nombre, "$options": "i"}}},
        {"$sort": {"fecha": -1}},
        {"$limit": limite},
        {"$project": {
            "fecha": 1,
            "tipo": 1,
            "ejercicio": "$ejercicios"
        }}
    ]
    
    resultados = list(db.gimnasio.aggregate(pipeline))
    
    return {
        "ejercicio_buscado": nombre,
        "total_registros": len(resultados),
        "historial": json.loads(dumps(resultados))
    }


def obtener_estadisticas_generales() -> dict:
    """
    Obtiene estadísticas generales del usuario.
    
    Returns:
        Resumen completo de estadísticas
    """
    total = db.gimnasio.count_documents({})
    
    # Por tipo
    por_tipo = list(db.gimnasio.aggregate([
        {"$group": {"_id": "$tipo", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]))
    
    # Por grupo muscular
    por_grupo = list(db.gimnasio.aggregate([
        {"$unwind": "$grupos_musculares"},
        {"$group": {"_id": "$grupos_musculares", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]))
    
    # Último entrenamiento
    ultimo = db.gimnasio.find_one({}, sort=[("fecha", -1)])
    
    # Esta semana
    hoy = datetime.now()
    inicio_semana = (hoy - timedelta(days=hoy.weekday())).strftime("%Y-%m-%d")
    esta_semana = db.gimnasio.count_documents({"fecha": {"$gte": inicio_semana}})
    
    return {
        "total_entrenamientos": total,
        "entrenamientos_esta_semana": esta_semana,
        "por_tipo": {item["_id"]: item["count"] for item in por_tipo},
        "por_grupo_muscular": {item["_id"]: item["count"] for item in por_grupo},
        "ultimo_entrenamiento": json.loads(dumps(ultimo)) if ultimo else None
    }


def calcular_progreso_ejercicio(nombre: str) -> dict:
    """
    Calcula el progreso de un ejercicio específico.
    
    Args:
        nombre: Nombre del ejercicio
    
    Returns:
        Análisis de progreso con pesos, tendencia, PRs
    """
    pipeline = [
        {"$unwind": "$ejercicios"},
        {"$match": {"ejercicios.nombre": {"$regex": nombre, "$options": "i"}}},
        {"$sort": {"fecha": 1}},
        {"$project": {
            "fecha": 1,
            "nombre": "$ejercicios.nombre",
            "peso": "$ejercicios.peso_kg",
            "series": "$ejercicios.series",
            "reps": "$ejercicios.repeticiones"
        }}
    ]
    
    registros = list(db.gimnasio.aggregate(pipeline))
    
    if not registros:
        return {"error": f"No se encontró el ejercicio: {nombre}"}
    
    # Procesar pesos
    pesos = []
    for r in registros:
        peso = r.get("peso")
        if peso and peso != "ajustar" and peso != "peso corporal":
            if isinstance(peso, list):
                peso = max([p for p in peso if isinstance(p, (int, float))], default=0)
            if isinstance(peso, (int, float)):
                pesos.append({"fecha": r["fecha"], "peso": peso})
    
    if not pesos:
        return {"ejercicio": nombre, "registros": len(registros), "sin_peso_registrado": True}
    
    primer_peso = pesos[0]["peso"]
    ultimo_peso = pesos[-1]["peso"]
    max_peso = max(p["peso"] for p in pesos)
    
    return {
        "ejercicio": nombre,
        "total_registros": len(registros),
        "primer_peso": primer_peso,
        "ultimo_peso": ultimo_peso,
        "peso_maximo": max_peso,
        "progreso_absoluto": round(ultimo_peso - primer_peso, 2),
        "progreso_porcentaje": round((ultimo_peso - primer_peso) / primer_peso * 100, 1) if primer_peso > 0 else 0,
        "tendencia": "subiendo" if ultimo_peso > primer_peso else "bajando" if ultimo_peso < primer_peso else "estable",
        "historial_pesos": pesos
    }


def obtener_prs() -> dict:
    """
    Obtiene los récords personales (PRs) del usuario.
    
    Returns:
        Lista de PRs por ejercicio
    """
    pipeline = [
        {"$unwind": "$ejercicios"},
        {"$match": {
            "ejercicios.peso_kg": {"$exists": True, "$ne": "ajustar", "$ne": "peso corporal"}
        }},
        {"$project": {
            "fecha": 1,
            "nombre": "$ejercicios.nombre",
            "peso": "$ejercicios.peso_kg",
            "series": "$ejercicios.series",
            "reps": "$ejercicios.repeticiones"
        }}
    ]
    
    registros = list(db.gimnasio.aggregate(pipeline))
    
    # Agrupar por ejercicio y encontrar máximo
    ejercicios = {}
    for r in registros:
        nombre = r["nombre"]
        peso = r["peso"]
        
        if isinstance(peso, list):
            peso = max([p for p in peso if isinstance(p, (int, float))], default=0)
        
        if not isinstance(peso, (int, float)):
            continue
        
        if nombre not in ejercicios or peso > ejercicios[nombre]["peso"]:
            ejercicios[nombre] = {
                "peso": peso,
                "fecha": r["fecha"],
                "series": r.get("series"),
                "reps": r.get("reps")
            }
    
    # Ordenar por peso
    prs = [
        {"ejercicio": k, **v}
        for k, v in sorted(ejercicios.items(), key=lambda x: x[1]["peso"], reverse=True)
    ]
    
    return {
        "total_ejercicios": len(prs),
        "prs": prs[:20]  # Top 20
    }


def consulta_personalizada(
    coleccion: str,
    filtro: dict,
    proyeccion: Optional[dict] = None,
    limite: int = 10,
    ordenar_por: Optional[str] = None,
    orden: int = -1
) -> dict:
    """
    Ejecuta una consulta personalizada en MongoDB.
    
    Args:
        coleccion: Nombre de la colección (gimnasio, entrenamiento_activo, etc.)
        filtro: Filtro MongoDB como diccionario
        proyeccion: Campos a incluir/excluir
        limite: Máximo de resultados
        ordenar_por: Campo para ordenar
        orden: 1 (ascendente) o -1 (descendente)
    
    Returns:
        Resultados de la consulta
    """
    colecciones_permitidas = ["gimnasio", "entrenamiento_activo", "logros", "usuario_gym", "entrenamiento_chat"]
    
    if coleccion not in colecciones_permitidas:
        return {"error": f"Colección no permitida. Usa: {colecciones_permitidas}"}
    
    try:
        coll = db[coleccion]
        cursor = coll.find(filtro, proyeccion)
        
        if ordenar_por:
            cursor = cursor.sort(ordenar_por, orden)
        
        cursor = cursor.limit(limite)
        docs = list(cursor)
        
        return {
            "coleccion": coleccion,
            "filtro_aplicado": filtro,
            "total_resultados": len(docs),
            "resultados": json.loads(dumps(docs))
        }
    except Exception as e:
        return {"error": str(e)}


def agregacion_personalizada(coleccion: str, pipeline: list) -> dict:
    """
    Ejecuta un pipeline de agregación en MongoDB.
    
    Args:
        coleccion: Nombre de la colección
        pipeline: Pipeline de agregación MongoDB
    
    Returns:
        Resultados de la agregación
    """
    colecciones_permitidas = ["gimnasio", "entrenamiento_activo", "logros", "usuario_gym"]
    
    if coleccion not in colecciones_permitidas:
        return {"error": f"Colección no permitida. Usa: {colecciones_permitidas}"}
    
    try:
        coll = db[coleccion]
        resultados = list(coll.aggregate(pipeline))
        
        return {
            "coleccion": coleccion,
            "pipeline": pipeline,
            "total_resultados": len(resultados),
            "resultados": json.loads(dumps(resultados))
        }
    except Exception as e:
        return {"error": str(e)}


def resumen_semanal(semanas_atras: int = 0) -> dict:
    """
    Obtiene resumen de una semana específica.
    
    Args:
        semanas_atras: 0 = esta semana, 1 = semana pasada, etc.
    
    Returns:
        Resumen detallado de la semana
    """
    hoy = datetime.now()
    inicio = hoy - timedelta(days=hoy.weekday() + (7 * semanas_atras))
    fin = inicio + timedelta(days=6)
    
    inicio_str = inicio.strftime("%Y-%m-%d")
    fin_str = fin.strftime("%Y-%m-%d")
    
    docs = list(db.gimnasio.find({
        "fecha": {"$gte": inicio_str, "$lte": fin_str}
    }).sort("fecha", 1))
    
    if not docs:
        return {
            "semana": f"{inicio_str} a {fin_str}",
            "entrenamientos": 0,
            "mensaje": "No hay entrenamientos esta semana"
        }
    
    # Contar series y ejercicios
    total_series = 0
    total_ejercicios = 0
    grupos = set()
    tipos = []
    
    for doc in docs:
        tipos.append(doc.get("tipo", "general"))
        for g in doc.get("grupos_musculares", []):
            grupos.add(g)
        for ej in doc.get("ejercicios", []):
            total_ejercicios += 1
            total_series += ej.get("series", 0)
    
    return {
        "semana": f"{inicio_str} a {fin_str}",
        "entrenamientos": len(docs),
        "total_series": total_series,
        "total_ejercicios": total_ejercicios,
        "grupos_trabajados": list(grupos),
        "tipos": tipos,
        "detalle": json.loads(dumps(docs))
    }


def comparar_semanas() -> dict:
    """
    Compara esta semana con la anterior.
    
    Returns:
        Comparativa de métricas entre semanas
    """
    esta = resumen_semanal(0)
    anterior = resumen_semanal(1)
    
    def calcular_cambio(actual, previo):
        if previo == 0:
            return 100 if actual > 0 else 0
        return round((actual - previo) / previo * 100, 1)
    
    return {
        "esta_semana": {
            "entrenamientos": esta.get("entrenamientos", 0),
            "series": esta.get("total_series", 0),
            "ejercicios": esta.get("total_ejercicios", 0)
        },
        "semana_pasada": {
            "entrenamientos": anterior.get("entrenamientos", 0),
            "series": anterior.get("total_series", 0),
            "ejercicios": anterior.get("total_ejercicios", 0)
        },
        "cambio_porcentaje": {
            "entrenamientos": calcular_cambio(
                esta.get("entrenamientos", 0),
                anterior.get("entrenamientos", 0)
            ),
            "series": calcular_cambio(
                esta.get("total_series", 0),
                anterior.get("total_series", 0)
            ),
            "ejercicios": calcular_cambio(
                esta.get("total_ejercicios", 0),
                anterior.get("total_ejercicios", 0)
            )
        }
    }


# ==================== HERRAMIENTAS DISPONIBLES ====================

MCP_TOOLS = {
    "listar_entrenamientos": {
        "function": listar_entrenamientos,
        "description": "Lista entrenamientos con filtros opcionales (tipo, fechas, límite)",
        "parameters": {
            "limite": "int - máximo de resultados (default 10)",
            "tipo": "str - filtrar por tipo (push, pull, legs)",
            "desde_fecha": "str - fecha inicio YYYY-MM-DD",
            "hasta_fecha": "str - fecha fin YYYY-MM-DD"
        }
    },
    "buscar_ejercicio": {
        "function": buscar_ejercicio,
        "description": "Busca un ejercicio específico en todo el historial",
        "parameters": {
            "nombre": "str - nombre del ejercicio (búsqueda parcial)",
            "limite": "int - máximo de resultados"
        }
    },
    "obtener_estadisticas": {
        "function": obtener_estadisticas_generales,
        "description": "Obtiene estadísticas generales del usuario",
        "parameters": {}
    },
    "calcular_progreso": {
        "function": calcular_progreso_ejercicio,
        "description": "Calcula el progreso de un ejercicio (pesos, tendencia, PRs)",
        "parameters": {
            "nombre": "str - nombre del ejercicio"
        }
    },
    "obtener_prs": {
        "function": obtener_prs,
        "description": "Obtiene los récords personales del usuario",
        "parameters": {}
    },
    "consulta_personalizada": {
        "function": consulta_personalizada,
        "description": "Ejecuta una consulta MongoDB personalizada",
        "parameters": {
            "coleccion": "str - nombre de la colección",
            "filtro": "dict - filtro MongoDB",
            "proyeccion": "dict - campos a incluir/excluir",
            "limite": "int - máximo de resultados",
            "ordenar_por": "str - campo para ordenar",
            "orden": "int - 1 (asc) o -1 (desc)"
        }
    },
    "agregacion": {
        "function": agregacion_personalizada,
        "description": "Ejecuta un pipeline de agregación MongoDB",
        "parameters": {
            "coleccion": "str - nombre de la colección",
            "pipeline": "list - pipeline de agregación"
        }
    },
    "resumen_semanal": {
        "function": resumen_semanal,
        "description": "Obtiene resumen de una semana (0=esta, 1=pasada, etc.)",
        "parameters": {
            "semanas_atras": "int - 0 para esta semana"
        }
    },
    "comparar_semanas": {
        "function": comparar_semanas,
        "description": "Compara métricas de esta semana vs la anterior",
        "parameters": {}
    }
}


def ejecutar_herramienta(nombre: str, **kwargs) -> dict:
    """Ejecuta una herramienta MCP por nombre"""
    if nombre not in MCP_TOOLS:
        return {"error": f"Herramienta no encontrada: {nombre}", "disponibles": list(MCP_TOOLS.keys())}
    
    try:
        return MCP_TOOLS[nombre]["function"](**kwargs)
    except Exception as e:
        return {"error": str(e)}


def listar_herramientas() -> dict:
    """Lista todas las herramientas MCP disponibles"""
    return {
        "herramientas": [
            {
                "nombre": k,
                "descripcion": v["description"],
                "parametros": v["parameters"]
            }
            for k, v in MCP_TOOLS.items()
        ]
    }


# Para testing directo
if __name__ == "__main__":
    print("=== Testing MCP MongoDB ===\n")
    
    print("1. Estadísticas generales:")
    print(serialize(obtener_estadisticas_generales()))
    
    print("\n2. PRs:")
    print(serialize(obtener_prs()))
    
    print("\n3. Comparar semanas:")
    print(serialize(comparar_semanas()))
