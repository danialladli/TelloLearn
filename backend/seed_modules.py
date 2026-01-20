import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "TelloLearnDB"
COLLECTION_NAME = "Modules"

# MINIMIZED DATA: No 'correct_answer' field
modules_data = [
    {
        "id": "1",
        "title": "Basic Flight Control",
        "description": "Execute Basic Flight Routines with Tello and Python.",
        "video_url": "https://www.youtube.com/embed/wn3UVB9xoVk",
        "docs": """# Introduction\nIn this foundational module... (keep your full docs here)""",
        "default_code": "from djitellopy import Tello\nimport time\n\n# 1. Connect\ndrone = Tello()\ndrone.connect()\nprint(f'Battery: {drone.get_battery()}%')\n\n# 2. Mission\ndrone.takeoff()\ntime.sleep(2)\n\ndrone.move_forward(30) # cm\ndrone.rotate_clockwise(90)\n\n# 3. Land\ndrone.land()",
        "is_active": True
    },
    {
        "id": "2",
        "title": "Landing Pad Accuracy",
        "description": "Utilize downward infrared camera to detect Mission Pads.",
        "video_url": "https://www.youtube.com/embed/Uo2KovDEJTs",
        "docs": """# Introduction\nPrecision landing is critical...""",
        "default_code": "from djitellopy import Tello\n\ndrone = Tello()\ndrone.connect()\n\n# Enable Downward Camera Detection\ndrone.enable_mission_pads()\ndrone.set_mission_pad_detection_direction(2) # Downward\n\ndrone.takeoff()\n\n# Mission: Hover until Pad 1 is found\npad = drone.get_mission_pad_id()\nif pad == 1:\n    drone.land()\nelse:\n    print('Searching for Landing Pad...') ",
        "is_active": True
    },
    {
        "id": "3",
        "title": "Alphabet Recognition",
        "description": "Real-time Object Tracking with OpenCV.",
        "video_url": "https://www.youtube.com/embed/vDOkUHNdmKs",
        "docs": """# Introduction\nThis advanced module introduces Computer Vision...""",
        "default_code": "import cv2\nimport numpy as np\nfrom djitellopy import Tello\n\ndrone = Tello()\ndrone.connect()\ndrone.streamon()\n\nwhile True:\n    frame = drone.get_frame_read().frame\n    \n    # Convert to Grayscale\n    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\n    \n    cv2.imshow('Drone Vision', gray)\n    if cv2.waitKey(1) & 0xFF == ord('q'):\n        break",
        "is_active": True
    },
    {
        "id": "4",
        "title": "Voice Command",
        "description": "Integrate Automatic Speech Recognition (ASR).",
        "video_url": "https://www.youtube.com/embed/lJScltStcJY",
        "docs": """# Introduction\nMove beyond keyboard controls...""",
        "default_code": "import speech_recognition as sr\nfrom djitellopy import Tello\n\n# Initialize Recognizer\nr = sr.Recognizer()\nmic = sr.Microphone()\n\ndef listen_command():\n    with mic as source:\n        print('Listening...')\n        audio = r.listen(source)\n    try:\n        return r.recognize_google(audio).lower()\n    except: \n        return ''\n\n# Main Loop\ncmd = listen_command()\nif 'take off' in cmd:\n    drone.takeoff()",
        "is_active": True
    },
    {
        "id": "5",
        "title": "Swarm Programming",
        "description": "Control multiple Tello drones simultaneously.",
        "video_url": "https://www.youtube.com/embed/cIsddY4SKgA",
        "docs": """# Introduction\nThe pinnacle of drone programming...""",
        "default_code": "from djitellopy import TelloSwarm\n\n# IPs of the two drones connected to the router\nswarm_ips = ['192.168.10.2', '192.168.10.3']\n\nswarm = TelloSwarm.fromIps(swarm_ips)\nswarm.connect()\n\n# Command both to take off\nswarm.takeoff()\n\n# Perform synchronized flip\nswarm.flip('l')\n\nswarm.land()",
        "is_active": True
    }
]

async def seed_database():
    print(f"🌱 Connecting to MongoDB at {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    print(f"📦 Preparing to upsert {len(modules_data)} modules...")

    for module in modules_data:
        # We explicitly unset correct_answer in case it exists from previous run
        await collection.update_one(
            {"id": module["id"]},
            {
                "$set": module,
                "$unset": {"correct_answer": ""} 
            },
            upsert=True
        )
        print(f"   ✅ Processed Module {module['id']}")

    print("\n🎉 Database minimized! 'correct_answer' field removed.")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())

