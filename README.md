## 📦 Getting Started

### Backend (Ground Station)

```bash
# Navigate to backend folder
cd backend

# Start the FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

In a second terminal, start the ngrok tunnel to expose the backend publicly:

```bash
# Start ngrok tunnel (Asia Pacific region for lower latency)
ngrok http 8000 --region=ap
```

Copy the HTTPS URL that ngrok provides (e.g. `https://xxxx.ngrok-free.app`).

> **Every time you restart ngrok**, update `VITE_API_URL` in the Vercel dashboard with the new URL and trigger a redeploy. If you have a static ngrok domain, this step is only done once.

---

### Web App

The web app is deployed on **Vercel** and is always accessible at:
**https://tellolearn.vercel.app**

To run it locally for development:

```bash
cd web-app
npm run dev
# Open http://localhost:5173 in your browser
```

> Local dev uses `http://127.0.0.1:8000` automatically (see `web-app/.env`).
> The deployed Vercel build uses the `VITE_API_URL` set in the Vercel dashboard.

---

### Mobile App

```bash
# Navigate to mobile app folder
cd mobile-app

# Start Expo Metro bundler
npx expo start
```

Scan the QR code in the terminal using the **Expo Go** app on your phone.

Set the backend URL in `mobile-app/TelloLearn-mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app
```

> Load the app on your phone while connected to your home WiFi first.
> Once fully running, switch your phone's WiFi to the **TELLO-XXXXXX** network to fly the drone.

---

### Environment Variables

| File | Variable | Value |
|------|----------|-------|
| `backend/.env` | `GEMINI_API_KEY` | Your Gemini API key |
| `backend/.env` | `MAIL_USERNAME` | Gmail address for password reset emails |
| `backend/.env` | `MAIL_PASSWORD` | Gmail App Password (not your normal password) |
| `backend/.env` | `FRONTEND_URL` | `https://tellolearn.vercel.app` |
| `web-app/.env` | `VITE_API_URL` | `http://127.0.0.1:8000` (local dev) |
| Vercel Dashboard | `VITE_API_URL` | Your ngrok URL (production) |
| `mobile-app/.env` | `EXPO_PUBLIC_API_URL` | Your ngrok URL |
