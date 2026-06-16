import streamlit as st
import pandas as pd

st.title("Model Comparison")

comparison = pd.DataFrame(
    {
        "Model":[
            "Random Forest",
            "XGBoost"
        ],
        "Accuracy":[
            93.29,
            92.55
        ]
    }
)

st.dataframe(comparison)