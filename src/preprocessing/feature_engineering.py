import pandas as pd

df = pd.read_csv(
    "data/processed/cleaned.csv"
)

df["date_time"] = pd.to_datetime(
    df["date_time"]
)

df["hour"] = df["date_time"].dt.hour

df["day_of_week"] = (
    df["date_time"].dt.dayofweek
)

df["month"] = (
    df["date_time"].dt.month
)

df["year"] = (
    df["date_time"].dt.year
)

df["is_weekend"] = (
    df["day_of_week"] >= 5
).astype(int)

df["rush_hour"] = (
    (
        (df["hour"] >= 7)
        &
        (df["hour"] <= 10)
    )
    |
    (
        (df["hour"] >= 16)
        &
        (df["hour"] <= 19)
    )
).astype(int)

df.to_csv(
    "data/processed/features.csv",
    index=False
)

print("Features Created")