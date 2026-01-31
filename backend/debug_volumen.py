from pymongo import MongoClient
from datetime import datetime, timedelta

c = MongoClient('mongodb+srv://dbbot:juan0521@cluster0.yrat3g7.mongodb.net/n8n_memoria')
db = c['n8n_memoria']
docs = list(db['gimnasio'].find({}).sort("fecha", 1))

print(f"Total docs: {len(docs)}")

volumen_por_semana = {}

for doc in docs:
    fecha_str = doc.get("fecha")
    print(f"\n--- Doc: {doc.get('nombre')} | Fecha: {fecha_str}")
    
    if not fecha_str:
        print("  Sin fecha!")
        continue
    
    try:
        fecha = datetime.strptime(fecha_str, "%Y-%m-%d")
        inicio_semana = fecha - timedelta(days=fecha.weekday())
        semana_key = inicio_semana.strftime("%Y-%m-%d")
        
        print(f"  Semana: {semana_key}")
        
        if semana_key not in volumen_por_semana:
            volumen_por_semana[semana_key] = {"series": 0, "ejercicios": 0, "entrenamientos": 0}
        
        volumen_por_semana[semana_key]["entrenamientos"] += 1
        
        for ej in doc.get("ejercicios", []):
            series = ej.get("series", 0)
            print(f"    Ejercicio: {ej.get('nombre')} | Series: {series} (type: {type(series)})")
            if isinstance(series, (int, float)):
                volumen_por_semana[semana_key]["series"] += series
            volumen_por_semana[semana_key]["ejercicios"] += 1
    except Exception as e:
        print(f"  ERROR: {e}")
        continue

print("\n\n=== RESULTADO ===")
for k, v in sorted(volumen_por_semana.items()):
    print(f"{k}: {v}")
