import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

import joblib

df = pd.read_csv(
    "data/processed/final_dataset.csv"
)

X = df[
    [
        "temp",
        "rain_1h",
        "snow_1h",
        "clouds_all",
        "hour",
        "day_of_week",
        "month",
        "is_weekend",
        "rush_hour"
    ]
]

y = df["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = joblib.load(
    "models/random_forest.pkl"
)

pred = model.predict(X_test)

print(
    classification_report(
        y_test,
        pred
    )
)