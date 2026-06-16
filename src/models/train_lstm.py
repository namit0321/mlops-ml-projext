import pandas as pd
import numpy as np

from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Input

print("Loading dataset...")

df = pd.read_csv("data/processed/final_dataset.csv")

# Use only 5000 rows
df = df.tail(5000)

traffic = df["traffic_volume"].values

scaler = MinMaxScaler()

traffic_scaled = scaler.fit_transform(
    traffic.reshape(-1, 1)
)

sequence_length = 12

X = []
y = []

for i in range(sequence_length, len(traffic_scaled)):
    X.append(traffic_scaled[i-sequence_length:i])
    y.append(traffic_scaled[i])

X = np.array(X)
y = np.array(y)

print("X Shape:", X.shape)

model = Sequential([
    Input(shape=(X.shape[1], X.shape[2])),
    LSTM(16),
    Dense(1)
])

model.compile(
    optimizer="adam",
    loss="mse"
)

print("Training Started...")

model.fit(
    X,
    y,
    epochs=1,
    batch_size=128,
    verbose=1
)

model.save("models/lstm.h5")

print("LSTM Saved Successfully")