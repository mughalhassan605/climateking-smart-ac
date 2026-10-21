import dgram from 'react-native-udp';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

// Standalone diagnostic screen (not part of the shipping app). It scans the phone's Wi-Fi for
// air conditioners and reports which protocol each speaks, so we know whether the Climate King
// (Gree) app can control a given unit or whether it needs a Tuya adapter.
//
// Gree:  UDP broadcast {"t":"scan"} to :7000, replies are {"t":"pack"/"dev", cid, ...}
// Tuya:  devices announce themselves on UDP 6666/6667 every few seconds (encrypted, but the
//        source IP + packet is the signal that a Tuya/SmartLife device is present)

const BROADCASTS = [
  '255.255.255.255',
  '192.168.0.255',
  '192.168.1.255',
  '192.168.8.255',
  '192.168.88.255',
  '192.168.100.255',
  '192.168.31.255',
  '192.168.68.255',
  '10.0.0.255',
];

type Found = { ip: string; proto: 'Gree' | 'Tuya'; detail: string };

export default function ScannerApp() {
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [found, setFound] = useState<Record<string, Found>>({});
  const socketsRef = useRef<any[]>([]);

  const addLog = useCallback((line: string) => setLog(prev => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 40)), []);
  const addFound = useCallback((f: Found) => setFound(prev => (prev[f.ip]?.proto === 'Gree' ? prev : { ...prev, [f.ip]: f })), []);

  const stop = useCallback(() => {
    socketsRef.current.forEach(s => {
      try {
        s.close();
      } catch {}
    });
    socketsRef.current = [];
    setScanning(false);
  }, []);

  const scan = useCallback(() => {
    setFound({});
    setLog([]);
    setScanning(true);
    addLog('Scanning for 15s — make sure the AC is ON and this phone is on the same Wi-Fi (2.4 GHz).');

    // --- Gree: broadcast scan + listen ---
    const gree: any = dgram.createSocket({ type: 'udp4', reusePort: true });
    gree.on('message', (msg: any, rinfo: { address: string }) => {
      const text = msg.toString();
      try {
        const d = JSON.parse(text);
        if (d && (d.t === 'pack' || d.t === 'dev')) {
          addFound({ ip: rinfo.address, proto: 'Gree', detail: `cid=${d.cid ?? ''}` });
          addLog(`GREE reply from ${rinfo.address}`);
        }
      } catch {}
    });
    gree.on('error', (e: Error) => addLog(`gree socket: ${e.message}`));
    gree.bind(0, () => {
      try {
        gree.setBroadcast(true);
      } catch {}
      const ping = JSON.stringify({ t: 'scan' });
      const blast = () => BROADCASTS.forEach(a => gree.send(ping, undefined, undefined, 7000, a, () => {}));
      blast();
      const iv = setInterval(blast, 2000);
      (gree as any)._iv = iv;
    });
    socketsRef.current.push(gree);

    // --- Tuya: listen for device announcements ---
    [6666, 6667].forEach(port => {
      const t: any = dgram.createSocket({ type: 'udp4', reusePort: true });
      t.on('message', (msg: any, rinfo: { address: string }) => {
        addFound({ ip: rinfo.address, proto: 'Tuya', detail: `udp ${port}, ${msg.length}B` });
        addLog(`TUYA announce from ${rinfo.address} (:${port})`);
      });
      t.on('error', () => {});
      try {
        t.bind(port, () => {
          // Android filters broadcast UDP unless a Wi-Fi multicast lock is held; joining a
          // multicast group makes react-native-udp acquire that lock, which also keeps the
          // Tuya 255.255.255.255 announcements flowing to us.
          try {
            t.addMembership('224.0.0.251');
          } catch {}
        });
      } catch {}
      socketsRef.current.push(t);
    });

    setTimeout(() => {
      socketsRef.current.forEach(s => {
        if ((s as any)._iv) clearInterval((s as any)._iv);
      });
      stop();
      addLog('Scan finished.');
    }, 15000);
  }, [addLog, addFound, stop]);

  const results = Object.values(found);
  const greeCount = results.filter(r => r.proto === 'Gree').length;
  const tuyaCount = results.filter(r => r.proto === 'Tuya').length;

  let verdict = 'Turn an AC on and press Scan.';
  if (!scanning && (greeCount || tuyaCount)) {
    verdict = greeCount
      ? `${greeCount} Gree device(s) — the Climate King app WILL control these.`
      : `${tuyaCount} Tuya device(s), no Gree — these need a Tuya adapter; the Gree app can't see them.`;
  } else if (!scanning && log.length > 1) {
    verdict = 'Nothing answered. Confirm the AC is ON, on 2.4 GHz, and this phone is on that same Wi-Fi.';
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />
      <View style={styles.header}>
        <Text style={styles.title}>AC Wi-Fi Scanner</Text>
        <Text style={styles.sub}>Climate King diagnostic</Text>
      </View>

      <Pressable style={[styles.btn, scanning && styles.btnBusy]} onPress={scanning ? stop : scan}>
        {scanning ? <ActivityIndicator color="#fff" /> : null}
        <Text style={styles.btnText}>{scanning ? 'Scanning… tap to stop' : 'Scan now'}</Text>
      </Pressable>

      <View style={styles.verdictBox}>
        <Text style={styles.verdict}>{verdict}</Text>
      </View>

      <Text style={styles.section}>Devices found ({results.length})</Text>
      <FlatList
        data={results}
        keyExtractor={r => r.ip}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: item.proto === 'Gree' ? '#43A047' : '#FB8C00' }]}>
              <Text style={styles.badgeText}>{item.proto}</Text>
            </View>
            <Text style={styles.ip}>{item.ip}</Text>
            <Text style={styles.detail}>{item.detail}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No devices yet.</Text>}
      />

      <Text style={styles.section}>Log</Text>
      <FlatList
        data={log}
        keyExtractor={(l, i) => String(i)}
        style={styles.logList}
        renderItem={({ item }) => <Text style={styles.logLine}>{item}</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F8', paddingHorizontal: 20 },
  header: { paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#263238' },
  sub: { fontSize: 13, color: '#78909C', marginTop: 2 },
  btn: {
    flexDirection: 'row',
    gap: 10,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#78909C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnBusy: { backgroundColor: '#607D8B' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  verdictBox: { backgroundColor: '#ECEFF1', borderRadius: 12, padding: 14, marginTop: 14 },
  verdict: { fontSize: 15, color: '#37474F', lineHeight: 21 },
  section: { fontSize: 12, fontWeight: '600', color: '#90A4AE', textTransform: 'uppercase', marginTop: 18, marginBottom: 6 },
  list: { maxHeight: 220 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CFD8DC' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ip: { fontSize: 15, color: '#263238', fontWeight: '600' },
  detail: { fontSize: 13, color: '#78909C', marginLeft: 'auto' },
  empty: { color: '#B0BEC5', paddingVertical: 12 },
  logList: { flex: 1 },
  logLine: { fontSize: 12, color: '#607D8B', fontFamily: 'monospace', paddingVertical: 2 },
});
