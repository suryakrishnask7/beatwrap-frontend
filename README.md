# 🎵 BeatWrap! — Wrapped In Your Rhythm

A smart weekly music insights app with AI-powered Tamil movie character matching, mood tracking, and friend compatibility.

---

## 📁 Project Structure

```
beatwrap/               → React Native mobile app (Expo)
beatwrap-backend/       → Node.js + Express API server
```

---

## 🚀 Setup Guide

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- MongoDB Atlas account
- Spotify Developer account
- Groq API key

---

### 1. Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `beatwrap://`
4. Copy your **Client ID** and **Client Secret**

---

### 2. Backend Setup

```bash
cd beatwrap-backend
npm install
cp .env.example .env
# Fill in your .env values
npm run dev
```

Your `.env` should look like:
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/beatwrap
JWT_SECRET=some_random_secret_string
GROQ_API_KEY=gsk_your_groq_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

---

### 3. Mobile App Setup

```bash
cd beatwrap
npm install
```

Edit `app.json` → update the `extra` section:
```json
{
  "extra": {
    "SPOTIFY_CLIENT_ID": "your_spotify_client_id",
    "BACKEND_URL": "http://your-server-ip:5000",
    "GROQ_API_KEY": "gsk_your_groq_key"
  }
}
```

Then run:
```bash
npx expo start
```

Scan the QR code with Expo Go app on your phone.

---

## 🏗️ Architecture

### Mobile App (React Native / Expo)
| Screen | Description |
|--------|-------------|
| `LoginScreen` | Spotify OAuth login with PKCE |
| `HomeScreen` | Weekly Wrapped with AI story + Tamil character |
| `MoodScreen` | Daily emoji mood logging with week calendar |
| `StatsScreen` | Exploration, discovery, replay metrics with week comparison |
| `FriendsScreen` | Friend list + AI compatibility score |
| `ProfileScreen` | User profile + settings |

### Backend (Node.js + Express)
| Route | Description |
|-------|-------------|
| `POST /api/auth/spotify` | Register/login via Spotify |
| `POST /api/wrap/save` | Save weekly wrap data |
| `GET /api/wrap/:userId/:weekKey` | Get specific wrap |
| `GET /api/wrap/:userId/history` | Get wrap history |
| `POST /api/mood/:userId` | Log daily mood |
| `GET /api/mood/:userId/:weekKey` | Get week's moods |
| `GET /api/friends/search` | Search users |
| `POST /api/friends/request` | Send friend request |
| `PUT /api/friends/request/:id/accept` | Accept request |
| `GET /api/friends/:userId` | Get friends list |
| `GET /api/friends/compatibility/:u1/:u2` | Get compatibility score |

---

## 🤖 AI Features

### Weekly Wrap Generation (Groq + Llama 3.3 70B)
- Cinematic story about your week's listening
- Tamil movie character assignment
- Protagonist archetype
- Dominant vibe & energy level

### Friend Compatibility Engine
- Genre overlap analysis
- Exploration index comparison
- AI-generated vibe description
- 0-100% compatibility score

---

## 🎨 Design System
- **Colors**: Deep dark background (#0A0A0F) with vivid accents
- **Accent**: Crimson red (#FF3366)
- **Secondary**: Violet (#8B5CF6), Cyan (#06B6D4), Gold (#FFD700)
- **Typography**: System fonts with heavy weight hierarchy
- **Style**: Cinema-noir dark aesthetic

---

## 📱 Features
- ✅ Spotify OAuth with PKCE (secure)
- ✅ Weekly Wrapped (every Sunday)
- ✅ AI Tamil character matching
- ✅ Daily mood emoji logging
- ✅ Smart metrics (exploration, discovery, replay)
- ✅ Week-to-week comparison
- ✅ Friend compatibility engine
- ✅ Offline cached mode (AsyncStorage)
- ✅ Dark mode (permanent)

---

## 🔐 Security
- Spotify tokens stored in Expo SecureStore (encrypted)
- JWT authentication for all API calls
- OAuth PKCE flow (no client secret on device)
- Helmet.js + rate limiting on backend

---

## 📦 Deployment

### Backend → Render
1. Push `beatwrap-backend` to GitHub
2. Create Web Service on Render
3. Add environment variables
4. Deploy

### App → Expo EAS
```bash
npm install -g eas-cli
eas login
eas build --platform android
eas build --platform ios
```

---

## 🎬 Tamil Characters Used
The AI picks from actual Tamil cinema characters like:
- Vikram (Mahaan), Raghavan (Vikram Vedha)
- Azhagarsamy (96), Krishnamurthy (Subramaniapuram)
- And many more based on your vibe!
