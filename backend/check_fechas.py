from pymongo import MongoClient

c = MongoClient('mongodb+srv://dbbot:juan0521@cluster0.yrat3g7.mongodb.net/n8n_memoria')
db = c['n8n_memoria']
docs = list(db['gimnasio'].find({}).limit(5))

print(f"Total docs: {db['gimnasio'].count_documents({})}")
for d in docs[:3]:
    print(f"Fecha: {d.get('fecha')} | Tipo: {type(d.get('fecha'))}")
