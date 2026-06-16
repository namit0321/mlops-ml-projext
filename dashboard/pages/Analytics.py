import streamlit as st
import pandas as pd
import plotly.express as px

st.title("Traffic Analytics")

df = pd.read_csv(
    "data/processed/final_dataset.csv"
)

hourly = (
    df.groupby("hour")["traffic_volume"]
    .mean()
    .reset_index()
)

fig = px.line(
    hourly,
    x="hour",
    y="traffic_volume",
    title="Average Traffic by Hour"
)

st.plotly_chart(
    fig,
    use_container_width=True
)