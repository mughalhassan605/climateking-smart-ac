# ❄️ ClimateKing — Universal Smart AC IoT Platform

[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-blue.svg)](#)
[![Backend](https://img.shields.io/badge/Backend-Supabase%20Realtime-emerald.svg)](#)
[![Protocols](https://img.shields.io/badge/Protocols-Gree%20%7C%20Tuya%20%7C%20Haier-orange.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](#)

**ClimateKing** is a production-grade, multi-brand smart air conditioner control system and IoT command center. It unifies proprietary smart AC protocols across multiple manufacturers (**Climate King, Gree, Kenwood, Haier, Hyundai**) into a single, clean mobile app and real-time live telemetry dashboard.

---

## 🌟 Key Features

- **One app for every brand**, each over its own local protocol:

  | Brand | Pairs with app | Protocol |
  |---|---|---|
  | Climate King, Gree | Gree+ / EWPE Smart | Gree LAN, UDP 7000 |
  | Kenwood eSmart | AC Freedom | BroadLink + AUX, UDP 80 |
  | TCL | Intelligent AC (or TCL SmartLife → Smart Life row) | BroadLink DNA, UDP 80 |
  | Hyundai, other Smart Life units | Smart Life | Tuya LAN, TCP 6668 + Tuya cloud backup |
  | Haier | HaiSmart / U+ | uSS, TCP 56800 |

- **Control from anywhere** through the **Home Bridge** (`bridge/`): a small Python service on any
  always-on device at home (PC, Raspberry Pi, spare Android phone). The app queues commands in
  Supabase; the bridge runs them on the home Wi-Fi and writes the live state back.
- **Stays connected.** The old app held the AC session on the phone and called a unit offline after
  one lost UDP reply, so Gree units dropped after ~30 seconds. The bridge retries every request,
  reports "offline" only after 3 failed polls in a row, finds a unit again by MAC when its IP
  changes, and renegotiates keys after a module reset.
- **Fallbacks when the bridge is down:** Gree / Climate King are controlled straight from the phone
  on the home Wi-Fi; Smart Life units through the Tuya cloud (`supabase/functions/tuya-cloud`).
- **Private per account:** row level security ties every AC, key and command to the account that
  added it. Sign-in uses Supabase Auth.
- **Live web dashboard** (`dashboard/index.html`) and a **virtual Gree AC** (`simulator/gree_ac.py`)
  that speaks the real encrypted protocol for testing without hardware.

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
├── bridge/                       # Home Bridge (Python): keeps ACs connected, runs commands
│   ├── climateking_bridge/       # worker, Supabase store, drivers per brand
│   └── README.md                 # install on PC / Raspberry Pi / Android (Termux)
├── supabase/
│   ├── migrations/               # tables, row level security, realtime
│   └── functions/tuya-cloud/     # Tuya cloud fallback (Deno edge function)
├── dashboard/                    # Realtime Web Command Center
│   └── index.html                # Standalone Tailwind + React + Supabase dashboard
├── simulator/                    # Hardware Emulation Tools
│   ├── gree_ac.py                # Virtual Gree AC (real encrypted protocol)
│   └── simulate_ac.py            # Discovery beacons only
├── App.tsx                       # Root React Native application entry
├── index.js                      # Application registry & uncaught exception safety
└── package.json                  # Dependencies & scripts
```

---

## 🔌 Setting up remote control (do this once)

1. **Database.** In the Supabase SQL editor run
   `supabase/migrations/20261021000000_home_bridge.sql` (safe on the existing tables). ACs added
   before this have no owner; claim them with
   `update devices set owner_id = '<your user id>' where owner_id is null;`.
2. **Auth.** Supabase → Authentication: enable Email sign-in. For the in-app password reset, make
   the *Reset Password* email template show the code: `{{ .Token }}`.
3. **Home Bridge.** On a device at home: follow [`bridge/README.md`](bridge/README.md)
   (`pip install -e ".[haier]"`, fill in `bridge.env`, `climateking-bridge run`).
4. **Tuya cloud (optional, Hyundai / Smart Life).** Create a Tuya IoT project (see the bridge README),
   then `supabase functions deploy tuya-cloud` and
   `supabase secrets set TUYA_REGION=in TUYA_API_KEY=... TUYA_API_SECRET=...`.

Checks: `supabase/tests/run.sh` (migrations + row level security on a local PostgreSQL),
`cd bridge && pytest`, `node --experimental-strip-types --test supabase/functions/tuya-cloud/tuya.test.ts`.

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

### Option A: Virtual Gree AC (full protocol)

```bash
pip install cryptography
python3 simulator/gree_ac.py --drop 0.3     # answers scan/bind/status/commands, loses 30% of replies
```

Point the Home Bridge at it (`climateking-bridge check --brand gree --ip 127.0.0.1 --mac f4911e5a0c01`)
or let the bridge discover it on the LAN.

### Option A2: Discovery beacons only

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

Defined in [`supabase/migrations`](supabase/migrations); every table carries `owner_id` and is
limited to its owner by row level security.

| Table | Written by | Purpose |
|---|---|---|
| `devices` | app (display fields), bridge (live state) | one row per AC: brand, IP/MAC, power, mode, temperatures, status, last error |
| `device_secrets` | bridge / app | bind keys and local keys, kept out of `devices` and its realtime feed |
| `device_commands` | app queues, bridge / phone / Tuya function completes | one row per button press: `pending → running → done / failed / expired` |
| `bridges` | bridge | heartbeat; the app shows "Home Bridge online" from it |
| `discovered_devices` | bridge | units found on the LAN, listed under Add Device |
| `user_activity`, `error_logs` | app | telemetry |

---

## 📄 License

This project is licensed under the MIT License.
