import streamlit as st
import pandas as pd
import folium
from streamlit.components.v1 import html

st.title("Traffic Map")

m = folium.Map(
    location=[44.97, -93.26],
    zoom_start=10
)

folium.Marker(
    [44.97, -93.26],
    popup="Traffic Monitoring Point"
).add_to(m)

html(
    m._repr_html_(),
    height=600
)