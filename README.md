# ❄️ ClimateKing — Universal Smart AC IoT Platform

[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-blue.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Supabase%20Realtime-emerald.svg)](#)
[![Protocols](https://img.shields.io/badge/Protocols-Gree%20%7C%20Tuya%20%7C%20Haier-orange.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](#)

**ClimateKing** is a production-grade, multi-brand smart air conditioner control system and IoT command center. It unifies proprietary smart AC protocols across multiple manufacturers (**Climate King, Gree, Kenwood, Haier, Hyundai**) into a single, clean mobile app and real-time live telemetry dashboard.

---

## 🌟 Key Features

- **Multi-Brand Unified Control**:
  - **Gree & Climate King**: Native Gree UDP protocol (Port 7000 discovery & control).
  - **Kenwood & Hyundai**: Tuya SmartLife broadcast listener (UDP 6666/6667) & local TCP command dispatch.
  - **Haier**: SmartAir / hOn protocol listener (UDP port 56800) with automatic model detection.
- **Zero Hardcoding (Clean Slate Architecture)**:
  - Users start with an empty home and add/discover their own devices dynamically.
- **Resilient Wi-Fi Network Scanner**:
  - Auto-discovers smart ACs broadcasting on the local LAN without crashing on unhandled network packets.
  - Full packet de-duplication, safe socket termination, and background broadcast handlers.
- **Real-Time Supabase Cloud Sync**:
  - Instant bi-directional synchronization between the mobile app, cloud database, and live web admin dashboard.
  - Telemetry logging for all user interactions (power toggle, target temperature, mode changes, and hardware error logs).
- **Virtual AC Simulator**:
  - Built-in Python simulator (`simulator/simulate_ac.py`) to test Wi-Fi auto-discovery and control without requiring physical air conditioner hardware.
- **Live Web Command Center**:
  - Single-file standalone HTML/JS dashboard (`dashboard/index.html`) featuring real-time device controls, filter tabs, live user activity feeds, and hardware error monitoring.

---

## 🏗️ Repository Architecture

```
climateking-smart-ac/
├── src/                          # React Native Application Source
│   ├── components/               # Design system widgets & icons
│   ├── features/
│   │   ├── auth/                 # Sign-in & authentication (One-tap demo ready)
│   │   ├── devices/              # Multi-brand AC control logic & scanning
│   │   │   ├── AddDeviceScreen.tsx # UDP scanner & manual setup for Gree/Tuya/Haier
│   │   │   ├── DeviceControlScreen.tsx # Dial temp controller & mode selection
│   │   │   ├── supabaseDevicesService.ts # Realtime Supabase CRUD & dispatch
│   │   │   └── types.ts          # Brand, Mode, FanSpeed type definitions
│   │   ├── home/                 # Dynamic grid/list home screen
│   │   └── telemetry/            # User activity & error logging
│   └── i18n/                     # Multi-language localization
├── android/                      # Native Android project (Signed release build ready)
├── dashboard/                    # Realtime Web Command Center
│   └── index.html                # Standalone Tailwind + React + Supabase dashboard
├── simulator/                    # Hardware Emulation Tools
│   └── simulate_ac.py            # Virtual AC network beacon simulator
├── App.tsx                       # Root React Native application entry
├── index.js                      # Application registry & uncaught exception safety
└── package.json                  # Dependencies & scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or later
- **Java**: JDK 17 (recommended)
- **Android SDK**: Platform 34+, Build Tools 34.0.0
- **Python 3**: (Optional, for running the Virtual AC Simulator)

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/mughalhassan605/climateking-smart-ac.git
cd climateking-smart-ac

# Install dependencies
npm install
```

### 2. Running the Mobile App (Dev)

```bash
# Start Metro bundler
npm start

# Run on Android device or emulator
npm run android
```

### 3. Building Release APK

```bash
cd android
export ANDROID_HOME=~/Library/Android/sdk JAVA_HOME=$(/usr/libexec/java_home)
./gradlew assembleRelease
# The output APK will be generated at:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 🧪 Testing Without Physical Hardware

If you do not have a physical smart AC available on your Wi-Fi, you can test the entire system using two simple methods:

### Option A: Virtual AC Simulator (Wi-Fi Auto-Discovery Test)

Run the Python AC simulator on your computer (connected to the same Wi-Fi router as your test phone):

```bash
python3 simulator/simulate_ac.py
```

The simulator immediately begins broadcasting beacons for:
1. **Kenwood / Hyundai** (Tuya UDP ports 6666 & 6667)
2. **Haier Inverter** (SmartAir UDP port 56800)
3. **ClimateKing / Gree** (UDP port 7000 responder)

Now open the mobile app, navigate to **Add Device** -> **Scan**, tap **Start Scan**, and watch the units appear in real time!

### Option B: Manual Setup

1. In the app, open **Add Device** and stay on the **Manual Setup** tab.
2. Select any brand (**Haier**, **Kenwood**, **Gree**, **Climate King**, or **Hyundai**).
3. Choose a room (e.g. *Living Room*, *Bedroom*), enter a name, and tap **Save AC Device**.
4. Test power, temperature adjustments, and modes directly.

---

## 🖥️ Live Web Dashboard

Open `dashboard/index.html` in any web browser. The dashboard connects directly to Supabase Realtime:
- **Instant Controls**: Toggle power, raise/lower temperature, switch modes.
- **Brand Filtering**: Filter units by `All Brands`, `Gree / CK`, `Tuya (Kenwood/Hyundai)`, or `Haier (SmartAir)`.
- **Telemetry Feeds**: Observe real-time user behavior events and network/hardware exception logs.

---

## 🔒 Supabase Database Schema

The system uses three main PostgreSQL tables in Supabase:

```sql
-- Devices table
CREATE TABLE public.devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  brand TEXT NOT NULL, -- 'gree' | 'tuya' | 'haier'
  model TEXT,
  room_name TEXT,
  ip_address TEXT,
  mac_address TEXT,
  is_on BOOLEAN DEFAULT FALSE,
  mode TEXT DEFAULT 'cool',
  target_temp NUMERIC DEFAULT 24,
  current_temp NUMERIC DEFAULT 26,
  humidity NUMERIC DEFAULT 50,
  fan_speed TEXT DEFAULT 'auto',
  status TEXT DEFAULT 'online',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity telemetry
CREATE TABLE public.user_activity (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  device_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hardware and network error logs
CREATE TABLE public.error_logs (
  id BIGSERIAL PRIMARY KEY,
  error_type TEXT NOT NULL,
  message TEXT,
  device_brand TEXT,
  device_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📄 License

This project is licensed under the MIT License.
