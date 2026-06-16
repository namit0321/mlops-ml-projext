import streamlit as st
import openrouteservice
import folium
import os
import joblib
import datetime

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
                st.error(
                    "Location not found."
                )
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

# =========================
# Display Route
# =========================

if st.session_state.route_data is not None:

    try:

        data = st.session_state.route_data

        route = data["route"]

        source_coords = data["source_coords"]

        destination_coords = data["destination_coords"]

        summary = (
            route["features"][0]
            ["properties"]["summary"]
        )

        distance = (
            summary["distance"] / 1000
        )

        duration = (
            summary["duration"] / 60
        )

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

        m = folium.Map(
            location=[
                center_lat,
                center_lon
            ],
            zoom_start=10
        )

        folium.Marker(
            [
                source_coords[1],
                source_coords[0]
            ],
            popup=f"Source: {source}"
        ).add_to(m)

        folium.Marker(
            [
                destination_coords[1],
                destination_coords[0]
            ],
            popup=f"Destination: {destination}"
        ).add_to(m)

        route_points = [
            [coord[1], coord[0]]
            for coord in geometry
        ]

        folium.PolyLine(
            route_points,
            weight=6,
            color="blue"
        ).add_to(m)

        st_folium(
            m,
            width=1200,
            height=600
        )

        # =========================
        # AI Traffic Prediction
        # =========================

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

        # Temporary Weather Values
        # Next step: OpenWeatherMap API

        temp = 290

        rain_1h = 0

        snow_1h = 0

        clouds_all = 40

        prediction = rf_model.predict(
            [[
                temp,
                rain_1h,
                snow_1h,
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

        st.markdown("---")

        st.subheader(
            "🤖 AI Traffic Prediction"
        )

        if traffic_level == 0:

            st.success(
                "🟢 LOW TRAFFIC"
            )

            st.success(
                "✅ Route is relatively clear."
            )

        elif traffic_level == 1:

            st.warning(
                "🟠 MEDIUM TRAFFIC"
            )

            st.warning(
                "⚠️ Moderate congestion expected."
            )

        else:

            st.error(
                "🔴 HIGH TRAFFIC"
            )

            st.error(
                "⚠️ Heavy congestion expected."
            )

        st.info(
            "Prediction generated using Random Forest Model (93.29% Accuracy)"
        )

    except Exception as e:

        st.exception(e)