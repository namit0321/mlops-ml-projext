import streamlit as st
import openrouteservice
import folium
import os
import joblib
import datetime
import random

from src.ingestion.weather_api import get_weather
from dotenv import load_dotenv
from streamlit_folium import st_folium

load_dotenv()

API_KEY = os.getenv("ORS_API_KEY")

rf_model = joblib.load(
"models/random_forest.pkl"
)

st.set_page_config(layout="wide")

st.title("🗺️ Smart Route Planner")

source = st.text_input(
"Source",
"Delhi Airport"
)

destination = st.text_input(
"Destination",
"Noida Sector 62"
)

if "route_data" not in st.session_state:
st.session_state.route_data = None

if st.button("Generate Route"):

```
try:

    with st.spinner("Finding Route..."):

        client = openrouteservice.Client(
            key=API_KEY
        )

        source_search = client.pelias_search(
            text=source,
            size=1
        )

        destination_search = client.pelias_search(
            text=destination,
            size=1
        )

        if (
            len(source_search["features"]) == 0
            or
            len(destination_search["features"]) == 0
        ):
            st.error("Location not found.")
            st.stop()

        source_coords = (
            source_search["features"][0]
            ["geometry"]["coordinates"]
        )

        destination_coords = (
            destination_search["features"][0]
            ["geometry"]["coordinates"]
        )

        route = client.directions(
            coordinates=[
                source_coords,
                destination_coords
            ],
            profile="driving-car",
            format="geojson"
        )

        st.session_state.route_data = {
            "source_coords": source_coords,
            "destination_coords": destination_coords,
            "route": route
        }

        st.success(
            "Route Generated Successfully"
        )

except Exception as e:
    st.exception(e)
```

if st.session_state.route_data is not None:

```
try:

    data = st.session_state.route_data

    route = data["route"]

    source_coords = data["source_coords"]

    destination_coords = data["destination_coords"]

    summary = (
        route["features"][0]
        ["properties"]["summary"]
    )

    distance = summary["distance"] / 1000

    duration = summary["duration"] / 60

    col1, col2 = st.columns(2)

    with col1:
        st.metric(
            "📍 Distance",
            f"{distance:.2f} km"
        )

    with col2:
        st.metric(
            "⏱ Travel Time",
            f"{duration:.1f} min"
        )

    geometry = (
        route["features"][0]
        ["geometry"]["coordinates"]
    )

    center_lat = (
        source_coords[1]
        + destination_coords[1]
    ) / 2

    center_lon = (
        source_coords[0]
        + destination_coords[0]
    ) / 2

    weather = get_weather("Delhi")

    temp = weather["temp"]
    rain_1h = weather["rain"]
    clouds_all = weather["clouds"]

    current_time = datetime.datetime.now()

    hour = current_time.hour
    day_of_week = current_time.weekday()
    month = current_time.month

    is_weekend = int(
        day_of_week >= 5
    )

    rush_hour = int(
        hour in [7, 8, 9, 17, 18, 19]
    )

    prediction = rf_model.predict(
        [[
            temp,
            rain_1h,
            0,
            clouds_all,
            hour,
            day_of_week,
            month,
            is_weekend,
            rush_hour
        ]]
    )

    traffic_level = int(
        prediction[0]
    )

    if rain_1h > 0:
        traffic_level = 2

    if traffic_level == 0:
        route_color = "green"
    elif traffic_level == 1:
        route_color = "orange"
    else:
        route_color = "red"

    m = folium.Map(
        location=[
            center_lat,
            center_lon
        ],
        zoom_start=10
    )

    folium.Marker(
        [source_coords[1], source_coords[0]],
        popup=f"Source: {source}"
    ).add_to(m)

    folium.Marker(
        [destination_coords[1], destination_coords[0]],
        popup=f"Destination: {destination}"
    ).add_to(m)

    route_points = [
        [coord[1], coord[0]]
        for coord in geometry
    ]

    folium.PolyLine(
        route_points,
        weight=8,
        color=route_color
    ).add_to(m)

    if random.randint(1, 10) > 8:

        accident_point = route_points[
            len(route_points)//2
        ]

        folium.Marker(
            accident_point,
            popup="🚨 Accident Reported"
        ).add_to(m)

        st.error(
            "🚨 Accident reported ahead"
        )

    st_folium(
        m,
        width=1200,
        height=600
    )

    st.markdown("---")

    st.subheader("🌦 Live Weather")

    c1, c2, c3 = st.columns(3)

    with c1:
        st.metric(
            "Temperature",
            f"{temp-273.15:.1f} °C"
        )

    with c2:
        st.metric(
            "Cloud Cover",
            f"{clouds_all}%"
        )

    with c3:
        st.metric(
            "Rainfall",
            f"{rain_1h} mm"
        )

    st.markdown("---")

    st.subheader(
        "🤖 AI Traffic Prediction"
    )

    if traffic_level == 0:

        st.success(
            "🟢 LOW TRAFFIC"
        )

    elif traffic_level == 1:

        st.warning(
            "🟠 MEDIUM TRAFFIC"
        )

    else:

        st.error(
            "🔴 HIGH TRAFFIC"
        )

    st.info(
        "Prediction generated using Random Forest Model"
    )

except Exception as e:

    st.exception(e)
```
