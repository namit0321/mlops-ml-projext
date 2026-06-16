import pandas as pd

df = pd.read_csv(
    "data/processed/features.csv"
)

def classify(volume):

    if volume < 2000:
        return 0

    elif volume < 5000:
        return 1

    return 2

df["target"] = (
    df["traffic_volume"]
    .apply(classify)
)

df.to_csv(
    "data/processed/final_dataset.csv",
    index=False
)

print("Target Created")