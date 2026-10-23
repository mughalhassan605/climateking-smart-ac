import dgram from 'react-native-udp';

export const GREE_PORT = 7000;

// react-native-udp's socket is an EventEmitter, but its bundled typings omit `on`.
type UdpSocket = ReturnType<typeof dgram.createSocket> & {
  on(event: 'message', fn: (msg: { toString(enc: string): string }, rinfo: { address: string; port: number }) => void): void;
  on(event: 'error', fn: (err: Error) => void): void;
};

export type ExchangeOutcome = 'replied' | 'timeout' | 'socketError' | 'sendFailed' | 'bindFailed';

export type ExchangeOptions = {
  message: object;
  address: string;
  port?: number;
  timeoutMs: number;
  broadcast?: boolean;
  /** Resend the datagram this many times inside the timeout window. */
  attempts?: number;
  /** Return true to stop listening (got what we needed). */
  onReply: (raw: string, from: { address: string; port: number }) => boolean;
};

export type ExchangeResult = { outcome: ExchangeOutcome; replies: number };

// The original transport (module 749) sent one datagram and gave up after the timeout.
// Gree Wi‑Fi modules drop packets while they doze, so one miss made the AC look offline.
// Here the same datagram is resent at even intervals until a reply arrives or time runs out.
export function lanExchange({
  message,
  address,
  port = GREE_PORT,
  timeoutMs,
  broadcast = false,
  attempts = 3,
  onReply,
}: ExchangeOptions): Promise<ExchangeResult> {
  return new Promise(resolve => {
    const socket = dgram.createSocket({ type: 'udp4', reusePort: true }) as UdpSocket;
    const payload = JSON.stringify(message);
    let replies = 0;
    let settled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const finish = (outcome: ExchangeOutcome) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      try {
        socket.close();
      } catch {
        // already closed
      }
      resolve({ outcome: replies > 0 && outcome === 'timeout' ? 'replied' : outcome, replies });
    };

    const GREE_BROADCAST_TARGETS = [
      '255.255.255.255',
      '192.168.1.255',
      '192.168.0.255',
      '192.168.8.255',
      '192.168.10.255',
      '192.168.18.255',
      '192.168.31.255',
      '192.168.88.255',
      '192.168.100.255',
      '10.0.0.255',
    ];

    const transmit = () => {
      if (settled) return;
      try {
        if (broadcast) {
          GREE_BROADCAST_TARGETS.forEach(tgt => {
            try {
              socket.send(payload, undefined, undefined, port, tgt, () => {});
            } catch {}
          });
        } else {
          socket.send(payload, undefined, undefined, port, address, err => {
            if (err) finish('sendFailed');
          });
        }
      } catch {
        finish('sendFailed');
      }
    };

    socket.on('message', (msg, rinfo) => {
      replies += 1;
      try {
        if (onReply(msg.toString('utf8'), rinfo)) finish('replied');
      } catch {
        // malformed or foreign packet, keep listening
      }
    });
    socket.on('error', () => finish('socketError'));

    try {
      socket.bind(0, () => {
        if (broadcast) {
          try {
            socket.setBroadcast(true);
          } catch {
            // some ROMs refuse; unicast still works
          }
          try {
            // Android Wi-Fi chipset blocks incoming UDP broadcasts unless a MulticastLock is held.
            // Joining a multicast group triggers react-native-udp to acquire that lock.
            (socket as any).addMembership('224.0.0.251');
          } catch {
            // ignore if multicast join fails
          }
        }
        const gap = Math.max(250, Math.floor(timeoutMs / Math.max(attempts, 1)));
        for (let i = 0; i < attempts; i += 1) timers.push(setTimeout(transmit, i * gap));
        timers.push(setTimeout(() => finish('timeout'), timeoutMs));
      });
    } catch {
      finish('bindFailed');
    }
  });
}
