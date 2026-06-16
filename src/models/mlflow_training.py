import pandas as pd
import mlflow
import mlflow.sklearn
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

# Load Dataset
df = pd.read_csv(
    "data/processed/final_dataset.csv"
)

# Features
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

# Target
y = df["target"]

# Train Test Split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

# Start MLflow Run
with mlflow.start_run():

    n_estimators = 100

    model = RandomForestClassifier(
        n_estimators=n_estimators,
        random_state=42
    )

    model.fit(
        X_train,
        y_train
    )

    pred = model.predict(
        X_test
    )

    accuracy = accuracy_score(
        y_test,
        pred
    )

    # Log Parameters
    mlflow.log_param(
        "model_name",
        "RandomForest"
    )

    mlflow.log_param(
        "n_estimators",
        n_estimators
    )

    # Log Metrics
    mlflow.log_metric(
        "accuracy",
        accuracy
    )

    # Save Model
    joblib.dump(
        model,
        "models/random_forest_mlflow.pkl"
    )

    # Log Model Artifact
    mlflow.log_artifact(
        "models/random_forest_mlflow.pkl"
    )

    # Log Sklearn Model
    mlflow.sklearn.log_model(
        model,
        "random_forest_model"
    )

    print(
        f"Accuracy: {accuracy}"
    )

print("MLflow Tracking Complete")