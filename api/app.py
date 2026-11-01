from fastapi import FastAPI, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import joblib
import requests

app = FastAPI(
    title="Smart Traffic Congestion Predictor"
)

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# LOAD MODEL
# =========================

model = joblib.load(
    "models/random_forest.pkl"
)

# =========================
# INPUT SCHEMA
# =========================

class TrafficInput(BaseModel):
    temp: float
    rain_1h: float
    snow_1h: float
    clouds_all: int
    hour: int
    day_of_week: int
    month: int
    is_weekend: int
    rush_hour: int


# =========================
# HOME
# =========================

@app.get("/")
def home():
    return {
        "message": "Traffic Prediction API Running"
    }


# =========================
# HEALTH CHECK
# =========================

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


# =========================
# SEARCH PLACES
# =========================

@app.get("/search")
def search_location(q: str = Query(...)):
    
    url = "https://nominatim.openstreetmap.org/search"

    params = {
        "q": q,
        "format": "jsonv2",
        "limit": 5,
        "countrycodes": "in"
    }

    headers = {
        "User-Agent": "SmartTrafficPredictor/1.0"
    }

    response = requests.get(
        url,
        params=params,
        headers=headers,
        timeout=10
    )

    response.raise_for_status()

    return response.json()


# =========================
# PREDICT
# =========================

@app.post("/predict")
def predict(data: TrafficInput):

    prediction = model.predict([
        [
            data.temp,
            data.rain_1h,
            data.snow_1h,
            data.clouds_all,
            data.hour,
            data.day_of_week,
            data.month,
            data.is_weekend,
            data.rush_hour
        ]
    ])

    labels = {
        0: "Low Traffic",
        1: "Medium Traffic",
        2: "High Traffic"
    }

    return {
        "prediction": int(prediction[0]),
        "label": labels[int(prediction[0])]
    }