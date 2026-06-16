import streamlit as st
import requests

st.title("Traffic Forecast")

temp = st.slider("Temperature", 250, 320, 288)
rain = st.slider("Rain", 0.0, 20.0, 0.0)
snow = st.slider("Snow", 0.0, 20.0, 0.0)
clouds = st.slider("Clouds", 0, 100, 40)

hour = st.slider("Hour", 0, 23, 8)
day = st.slider("Day Of Week", 0, 6, 1)

month = st.slider("Month", 1, 12, 10)

weekend = st.selectbox(
    "Weekend",
    [0,1]
)

rush = st.selectbox(
    "Rush Hour",
    [0,1]
)

if st.button("Predict"):

    payload = {
        "temp": temp,
        "rain_1h": rain,
        "snow_1h": snow,
        "clouds_all": clouds,
        "hour": hour,
        "day_of_week": day,
        "month": month,
        "is_weekend": weekend,
        "rush_hour": rush
    }

    response = requests.post(
        "http://127.0.0.1:8000/predict",
        json=payload
    )

    st.json(response.json())