import os

from djitellopy import Tello
from dotenv import load_dotenv

# Resolve .env relative to this file so the script works from any working directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

if __name__ == "__main__":
    ssid = os.getenv("ROUTER_SSID")
    password = os.getenv("ROUTER_PASSWORD")
    if not ssid or not password:
        raise ValueError("ROUTER_SSID and ROUTER_PASSWORD must be set in backend/.env")

    print(f"[SWARM SETUP] Connecting Tello to '{ssid}' ...")
    tello = Tello()
    tello.connect()
    tello.connect_to_wifi(ssid, password)
    print("[SWARM SETUP] Command sent. Tello will reboot — this is normal.")