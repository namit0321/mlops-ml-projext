import pandas as pd

df = pd.read_csv("data/raw/traffic.csv")

print("Original Shape:", df.shape)

df.drop_duplicates(inplace=True)

df["holiday"] = df["holiday"].fillna("None")

df.to_csv(
    "data/processed/cleaned.csv",
    index=False
)

print("Cleaned Shape:", df.shape)
print("Cleaning Complete")