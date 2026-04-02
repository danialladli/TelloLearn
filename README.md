## 📦 Getting Started

### Backend
```bash
# Navigate to Backend folder
cd backend

# Expose the server to local WiFi network.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Find your server IP Address
# Windows: Open Command Prompt and type ipconfig. Look for IPv4 Address (usually starts with 192.168.x.x)
# Mac/Linux: Open Terminal and type ifconfig (look for en0 or wlan0 -> inet).

# Update Mobile Config (change the base URL)
const API_URL = "http://192.168.x.x:8000";
```

### Web App
```bash
# Navigate to Web App folder
cd web-app

# Start development server
npm run dev

# Paste the link provided in terminal into your browser (usually http://localhost:5173).
```

### Mobile App
```bash
# Navigate to Mobile App folder
cd mobile-app

# Start Expo Metro bundler
npx expo start

# Scan the QR code in the terminal using Expo Go app on your mobile phone.
# Load the Expo app on your phone while connected to your home WiFi first.
# Once fully running on your screen, switch your phone's WiFi to the TELLO-XXXXXX network to fly the drone.
```

