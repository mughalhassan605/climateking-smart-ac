import { lanExchange } from './transport';

// A Gree / Climate King unit in setup (AP) mode runs its own hotspot and answers on 192.168.1.1.
// Sending it {"t":"wlan"} with the home network makes it leave AP mode and join that network,
// the same step the Gree+ app performs. The reply is plain JSON ({"t":"ret","r":200}).

export const AP_ADDRESS = '192.168.1.1';
export const AP_PASSWORD = '12345678';

export type ProvisionOutcome = 'accepted' | 'noReply' | 'failed';

export async function sendHomeWifi(ssid: string, password: string): Promise<ProvisionOutcome> {
  let accepted = false;
  const result = await lanExchange({
    message: { psw: password, ssid, t: 'wlan' },
    address: AP_ADDRESS,
    timeoutMs: 6000,
    attempts: 4,
    onReply: raw => {
      const reply = JSON.parse(raw);
      accepted = reply?.t === 'ret' && (reply.r === undefined || reply.r === 200);
      return accepted;
    },
  });
  if (accepted) return 'accepted';
  return result.outcome === 'timeout' ? 'noReply' : 'failed';
}
