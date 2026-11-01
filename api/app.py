
import os
from pathlib import Path

import joblib
import requests
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

# =========================
# APP CONFIGURATION
# =========================

app = FastAPI(title="Smart Traffic Congestion Predictor")

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# =========================
# LOAD MODEL
# =========================

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "random_forest.pkl"

try:
    model = joblib.load(MODEL_PATH)
    MODEL_ERROR = None
except Exception as error:
    model = None
    MODEL_ERROR = str(error)
    print(f"Model loading failed: {MODEL_ERROR}")


# =========================
# INPUT SCHEMA
# =========================

class TrafficInput(BaseModel):
    temp: float = Field(..., ge=150, le=350)
    rain_1h: float = Field(..., ge=0, le=1000)
    snow_1h: float = Field(..., ge=0, le=1000)
    clouds_all: int = Field(..., ge=0, le=100)
    hour: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    month: int = Field(..., ge=1, le=12)
    is_weekend: int = Field(..., ge=0, le=1)
    rush_hour: int = Field(..., ge=0, le=1)


# =========================
# DELHI-NCR SEARCH CONFIG
# =========================

NCR_BOUNDS = {
    "west": 76.4,
    "south": 27.0,
    "east": 78.3,
    "north": 29.8,
}

SEARCH_CACHE = {}


def inside_ncr(lon: float, lat: float) -> bool:
    return (
        NCR_BOUNDS["west"] <= lon <= NCR_BOUNDS["east"]
        and NCR_BOUNDS["south"] <= lat <= NCR_BOUNDS["north"]
    )


def add_result(results, lat, lon, display_name, source):
    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return

    if not inside_ncr(lon, lat):
        return

    results.append({
        "lat": str(lat),
        "lon": str(lon),
        "display_name": display_name or "Unnamed location",
        "source": source,
    })


def search_photon(query):
    results = []

    response = requests.get(
        "https://photon.komoot.io/api/",
        params={
            "q": query,
            "limit": 10,
            "lang": "en",
            "bbox": "76.4,27.0,78.3,29.8",
        },
        headers={"User-Agent": "SmartTrafficPredictor/1.0"},
        timeout=8,
    )
    response.raise_for_status()

    for feature in response.json().get("features", []):
        coordinates = feature.get("geometry", {}).get("coordinates", [])
        properties = feature.get("properties", {})

        if len(coordinates) < 2:
            continue

        lon, lat = coordinates[0], coordinates[1]

        parts = [
            properties.get("name"),
            properties.get("street"),
            properties.get("district"),
            properties.get("city"),
            properties.get("state"),
        ]

        display_name = ", ".join(dict.fromkeys(
            part.strip()
            for part in parts
            if isinstance(part, str) and part.strip()
        ))

        add_result(results, lat, lon, display_name or query, "Photon")

    return results


def search_nominatim(query):
    results = []

    response = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={
            "q": query,
            "format": "jsonv2",
            "limit": 10,
            "countrycodes": "in",
            "viewbox": "76.4,29.8,78.3,27.0",
            "bounded": 0,
            "addressdetails": 1,
        },
        headers={
            "User-Agent": "SmartTrafficPredictor/1.0 (local project)"
        },
        timeout=10,
    )
    response.raise_for_status()

    for item in response.json():
        add_result(
            results,
            item.get("lat"),
            item.get("lon"),
            item.get("display_name", query),
            "Nominatim",
        )

    return results


# =========================
# HOME AND HEALTH
# =========================

@app.get("/")
def home():
    return {"message": "Traffic Prediction API Running"}


@app.get("/health")
def health():
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Traffic model could not be loaded."
        )

    return {
        "status": "healthy",
        "model_loaded": True,
        "model": "Random Forest",
    }


# =========================
# SEARCH PLACES - DELHI NCR
# =========================

@app.get("/search")
def search_location(
    q: str = Query(..., min_length=2, max_length=200)
):
    query = q.strip()

    if len(query) < 2:
        return []

    cache_key = query.casefold()

    if cache_key in SEARCH_CACHE:
        return SEARCH_CACHE[cache_key]

    results = []
    queries_to_try = [query, f"{query}, Delhi NCR, India"]

    for search_query in queries_to_try:
        try:
            results = search_photon(search_query)
        except requests.RequestException as error:
            print("Photon search error:", error)

        if results:
            break

    if not results:
        for search_query in queries_to_try:
            try:
                results = search_nominatim(search_query)
            except requests.RequestException as error:
                print("Nominatim search error:", error)

            if results:
                break

    unique_results = []
    seen = set()

    for item in results:
        key = (
            round(float(item["lat"]), 5),
            round(float(item["lon"]), 5),
        )

        if key not in seen:
            seen.add(key)
            unique_results.append(item)

    final_results = unique_results[:10]
    SEARCH_CACHE[cache_key] = final_results

    # Prevent the in-memory cache from growing indefinitely.
    if len(SEARCH_CACHE) > 500:
        SEARCH_CACHE.pop(next(iter(SEARCH_CACHE)))

    return final_results


# =========================
# TRAFFIC PREDICTION
# =========================

@app.post("/predict")
def predict(data: TrafficInput):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Traffic model is unavailable. Check models/random_forest.pkl."
        )

    features = [[
        data.temp,
        data.rain_1h,
        data.snow_1h,
        data.clouds_all,
        data.hour,
        data.day_of_week,
        data.month,
        data.is_weekend,
        data.rush_hour,
    ]]

    try:
        predicted_class = int(model.predict(features)[0])
    except Exception as error:
        print("Prediction error:", error)
        raise HTTPException(
            status_code=500,
            detail="Traffic prediction failed."
        )

    labels = {
        0: "Low Traffic",
        1: "Medium Traffic",
        2: "High Traffic",
    }

    return {
        "prediction": predicted_class,
        "label": labels.get(predicted_class, "Unknown Traffic"),
        "model": "Random Forest",
        "prediction_type": "weather_and_time_based_estimate",
    }
