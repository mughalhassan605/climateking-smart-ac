# ClimateKing Home Bridge

A small program that runs on any always-on device at home: a PC or laptop, a Raspberry Pi, or a
spare Android phone. It keeps every AC on the home Wi-Fi connected, and carries commands from the
app to the AC through Supabase. That lets you control the ACs from anywhere, not only from home.

```
 App (anywhere) ──► Supabase ──► Home Bridge (home Wi-Fi) ──► AC
                  ◄── live state ◄──────────────────────────
```

## Quick start (Roman Urdu)

1. Ghar ke kisi hamesha-on device par Python 3.11+ install karein (PC, Raspberry Pi, ya purana
   Android phone Termux ke saath). Device usi Wi-Fi par ho jis par AC hain.
2. Is folder mein:
   ```bash
   python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
   pip install -e ".[haier]"
   cp bridge.env.example bridge.env                   # phir bridge.env mein email/password likhein
   climateking-bridge discover                        # ghar ke AC nazar aa rahe hain?
   climateking-bridge run                             # bridge chalu
   ```
3. App mein **Add Device** kholein. Bridge ke dhoonde hue AC wahan list mein aa jayenge.
4. Bridge chalta rahe to app ghar ke bahar se bhi AC control karegi. Bridge band ho to app
   batayegi "Home Bridge offline".

Windows: `deploy\windows-run.bat` · Raspberry Pi/Linux: `deploy/climateking-bridge.service` ·
Android: `deploy/termux-setup.sh`

## Supported ACs

| Brand (app) | `brand` | How the bridge reaches it | Needs |
|---|---|---|---|
| Climate King, Gree (Gree+ / EWPE Smart) | `gree` | Gree LAN protocol, UDP 7000 ([greeclimate]) | nothing: the key is negotiated automatically |
| Kenwood eSmart (AC Freedom) and other AUX-built units | `broadlink` | BroadLink + AUX payload, UDP 80 | "Lock device" off in AC Freedom |
| TCL (Intelligent AC app) | `tcl` | BroadLink/DNA JSON, UDP 80 | unlocked Wi-Fi module |
| Hyundai, TCL SmartLife, other Smart Life / Tuya units | `tuya` | Tuya LAN protocol 3.1–3.5, TCP 6668 ([tinytuya]); Tuya cloud as backup | the unit's local key (see below) |
| Haier (Haier / HaiSmart / U+ app) | `haier` | uSS protocol, TCP 56800 ([haismart-local]) | the unit's local key (see below) |

Not supported locally: TCL units that work only with the newer **TCL Home** app (cloud only),
Haier units on **hOn** (Europe) or **SmartAir2** (older), and units without a Wi-Fi module.

Which app does your unit use? Look at the sticker or manual, or check which app it is paired with
today. In Pakistan, Kenwood eSmart units ship with AC Freedom, Hyundai units with Smart Life,
Haier with HaiSmart, and TCL with Intelligent AC or TCL Home depending on the year.

## Staying connected (the old 30-second disconnect)

The first app held the AC session on the phone, and one dropped UDP reply marked the AC offline.
The bridge works differently:

* A missed reply is retried inside the same poll (Gree: three tries per request, and the session
  is kept through one bad poll).
* An AC is shown as **offline only after 3 failed polls in a row** (about 30 seconds), and comes back
  on the first good reply.
* When the router gives an AC a new IP address, the bridge finds it again by MAC and carries on.
* Gree keys are renegotiated automatically after a module reset, and BroadLink modules get the
  periodic ping their firmware needs to avoid rebooting.
* Commands older than two minutes are not run, so an AC never switches on long after the tap.

Tip: give each AC a fixed IP (DHCP reservation) in the router. It is not required, just faster.

## Tuya units (Hyundai, Smart Life)

Tuya only hands out a unit's local key through its cloud. Once:

1. Create a free account at [iot.tuya.com](https://iot.tuya.com) → **Cloud → Create Cloud Project**
   (any name, *Smart Home*, pick your data centre, e.g. *India* or *Central Europe*).
2. In the project: **Devices → Link App Account → Add App Account**, and scan the QR code with the
   Smart Life app (Me → scan icon). Your ACs appear in the list.
3. Copy **Access ID** and **Access Secret** from the project overview into `bridge.env` as
   `TUYA_API_KEY` / `TUYA_API_SECRET`, with `TUYA_REGION` (`in`, `eu`, `us`, `sg` or `cn`).
4. Add the units in the app, then run `climateking-bridge tuya-sync`. The bridge copies each unit's id
   and local key into your account.

With these credentials the bridge also sends a command through the Tuya cloud when the unit does not
answer locally. The Supabase function in `supabase/functions/tuya-cloud` does the same when the bridge
itself is offline.

## Haier units (HaiSmart)

Run `haismart-keys` (installed with `pip install -e ".[haier]"`), sign in with the Haier account the
AC is paired with, and enter the printed local key for that AC in the app. A Haier unit accepts
one local connection at a time, so do not also run another local integration (such as Home
Assistant's) against the same unit.

## Testing without an AC

```bash
python ../simulator/gree_ac.py --drop 0.3      # a virtual Gree AC that loses 30% of replies
climateking-bridge check --brand gree --ip 127.0.0.1 --mac f4911e5a0c01 --set '{"isOn": true}'
pip install -e ".[dev]" && pytest              # the test suite
```

`check` talks to one AC directly, without Supabase, which is also the first thing to try with a
real unit: `climateking-bridge check --brand broadlink --ip 192.168.1.40 --mac 34ea34aabbcc`.

## Credits

Protocol work this bridge builds on: [greeclimate], [python-broadlink], liaan/broadlink_ac_mqtt and
ArtemVladimirov/broadlinkac2mqtt (AUX payloads), jestempablo/home-assistant-tcl-intelligent-ac
(TCL, MIT; ported in `protocols/broadlink_dna.py`), [tinytuya], and enapt/[haismart-local] (MIT).

[greeclimate]: https://github.com/cmroche/greeclimate
[python-broadlink]: https://github.com/mjg59/python-broadlink
[tinytuya]: https://github.com/jasonacox/tinytuya
[haismart-local]: https://github.com/enapt/haismart-local
