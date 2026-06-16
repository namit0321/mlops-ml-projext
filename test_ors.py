from dotenv import load_dotenv
import os
import openrouteservice

load_dotenv()

key = os.getenv("ORS_API_KEY")

print("Key Loaded")

client = openrouteservice.Client(
    key=key
)

print("ORS Connected Successfully")