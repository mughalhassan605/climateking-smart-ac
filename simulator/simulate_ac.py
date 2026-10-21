#!/usr/bin/env python3
"""
ClimateKing — Virtual Smart AC Simulator
========================================
Ye script aapke Mac par chal kar ek real Wi-Fi Air Conditioner ki tarah act karta hai.
Jab mobile app mein "Start Scan" press karein ge, to ye script network par Gree, Kenwood (Tuya),
aur Haier ACs ke broadcast packets bhejta hai taake app bina kisi real AC ke bhi test ho sake!

Chalanay ka tareeqa:
  python3 /Users/wahab/Desktop/simulate_ac.py
"""

import socket
import time
import json
import threading

def get_broadcast_addrs():
    return ['255.255.255.255', '192.168.88.255', '192.168.1.255', '192.168.0.255']

def tuya_broadcaster():
    """Kenwood / Hyundai (Tuya SmartLife) discovery beacons on UDP 6666 & 6667"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    
    tuya_payload = json.dumps({
        "ip": "192.168.88.219",
        "gwId": "kenwood_sim_01",
        "active": 2,
        "productKey": "key_kenwood_inverter",
        "version": "3.3"
    }).encode('utf-8')
    
    while True:
        try:
            for b_ip in get_broadcast_addrs():
                try:
                    s.sendto(tuya_payload, (b_ip, 6666))
                    s.sendto(tuya_payload, (b_ip, 6667))
                except Exception:
                    pass
        except Exception:
            pass
        time.sleep(2)

def haier_broadcaster():
    """Haier SmartAir / hOn discovery beacons on UDP 56800"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    
    haier_payload = json.dumps({
        "device": "Haier SmartAir Inverter",
        "mac": "00:07:A8:12:34:56",
        "protocol": "hOn-SmartAir-56800"
    }).encode('utf-8')
    
    while True:
        try:
            for b_ip in get_broadcast_addrs():
                try:
                    s.sendto(haier_payload, (b_ip, 56800))
                except Exception:
                    pass
        except Exception:
            pass
        time.sleep(2)

def gree_responder():
    """Gree / Climate King listener and responder on UDP 7000"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    
    try:
        s.bind(('0.0.0.0', 7000))
    except Exception as e:
        print(f"[!] Port 7000 note: {e}")
    
    gree_response = json.dumps({
        "t": "dev",
        "cid": "gree_sim_1001",
        "name": "ClimateKing / Gree Inverter",
        "mac": "a4e57c8899aa",
        "model": "gree-fairy",
        "hid": "sim_ac"
    }).encode('utf-8')
    
    while True:
        try:
            data, addr = s.recvfrom(2048)
            s.sendto(gree_response, addr)
            print(f"[+] Gree Scan request answered from {addr[0]}")
        except Exception:
            time.sleep(1)

def main():
    print("=" * 65)
    print(" ❄️  ClimateKing — Virtual Smart AC Network Simulator")
    print("=" * 65)
    print("Ye script aapke Mac ko 3 Virtual ACs bana kar broadcast kar raha hai:")
    print("  1. Kenwood / Hyundai (Tuya protocol on UDP ports 6666/6667)")
    print("  2. Haier Inverter (SmartAir protocol on UDP port 56800)")
    print("  3. ClimateKing / Gree (Gree protocol on UDP port 7000)")
    print("-" * 65)
    print("Ab apne mobile phone ya app mein ja kar 'Start Scan' dabayein.")
    print("Mobile app foran in ACs ko detect kar ke list mein dikha de gi!")
    print("Band karne ke liye: Ctrl + C dabayein.")
    print("=" * 65)

    t1 = threading.Thread(target=tuya_broadcaster, daemon=True)
    t2 = threading.Thread(target=haier_broadcaster, daemon=True)
    t3 = threading.Thread(target=gree_responder, daemon=True)

    t1.start()
    t2.start()
    t3.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nSimulator stopped.")

if __name__ == '__main__':
    main()
