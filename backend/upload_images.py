import asyncio
import base64
import os
from motor.motor_asyncio import AsyncIOMotorClient

# CONFIGURATION
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "TelloLearnDB"
COLLECTION_NAME = "Modules"

# PATH TO YOUR IMAGES
# We assume this script is in /backend and images are in /web-app/assets
# Adjust this path if your images are somewhere else!
ASSETS_DIR = "../web-app/assets"

# MAP MODULE ID -> FILENAME
image_map = {
    "1": "basic_flight_control.png",
    "2": "landing_pad.png",
    "3": "alphabet_recognition.png",
    "4": "shortest_path.png",
    "5": "swarm.png"
}

def encode_image(image_path):
    """Reads an image file and converts it to a Base64 Data URL string"""
    try:
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            # Determine mime type based on extension
            if image_path.endswith(".png"):
                mime = "image/png"
            elif image_path.endswith(".jpg") or image_path.endswith(".jpeg"):
                mime = "image/jpeg"
            else:
                mime = "image/png" # Default
            
            return f"data:{mime};base64,{encoded_string}"
    except FileNotFoundError:
        print(f"   ⚠️ Warning: File not found at {image_path}")
        return None

async def upload_images():
    print(f"🌱 Connecting to MongoDB at {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    print("🖼️  Starting Image Upload...")

    for mod_id, filename in image_map.items():
        file_path = os.path.join(ASSETS_DIR, filename)
        
        print(f"   Processing Module {mod_id} -> {filename}...")
        image_data = encode_image(file_path)

        if image_data:
            await collection.update_one(
                {"id": mod_id},
                {"$set": {"image_data": image_data}},
                upsert=True
            )
            print(f"   ✅ Saved image for Module {mod_id}")
        else:
            print(f"   ❌ Skipped Module {mod_id} (Image missing)")

    print("\n🎉 Image upload complete! You can now delete the local assets folder if you want.")
    client.close()

if __name__ == "__main__":
    asyncio.run(upload_images())