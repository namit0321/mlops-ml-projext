from fastapi import FastAPI
from pydantic import BaseModel
import joblib

app = FastAPI(
    title="Smart Traffic Congestion Predictor"
)

model = joblib.load(
    "models/random_forest.pkl"
)

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

@app.get("/")
def home():
    return {
        "message": "Traffic Prediction API Running"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }

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