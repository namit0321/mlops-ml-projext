import pandas as pd

df = pd.read_csv("data/raw/traffic.csv")

print("\n===== COLUMNS =====")
print(df.columns.tolist())

print("\n===== SHAPE =====")
print(df.shape)

print("\n===== FIRST 5 ROWS =====")
print(df.head())