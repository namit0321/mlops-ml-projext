from dotenv import load_dotenv
import os
import requests

load_dotenv()

key = os.getenv("OPENWEATHER_API_KEY")

print("KEY:", key[:10])

url = f"https://api.openweathermap.org/data/2.5/weather?q=Delhi&appid={key}"

r = requests.get(url)

print(r.status_code)
print(r.text)