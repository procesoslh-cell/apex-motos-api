from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, SessionLocal
from .seed import seed
from .api.routes import router

app = FastAPI(title="APEX-MOTOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://apex-motos-api-m7p5.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()

app.include_router(router)

@app.get("/")
def root():
    return {"status": "ok", "name": "APEX-MOTOS"}