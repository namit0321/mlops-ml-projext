import requests
import os

from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv(
    "OPENWEATHER_API_KEY"
)

def get_weather(city):

    url = (
        "https://api.openweathermap.org/data/2.5/weather"
    )

    params = {
        "q": city,
        "appid": API_KEY
    }

    response = requests.get(
        url,
        params=params
    )

    data = response.json()

    return {
        "temp": data["main"]["temp"],
        "clouds": data["clouds"]["all"],
        "rain": data.get(
            "rain",
            {}
        ).get(
            "1h",
            0
        )
    }