import { supabase } from '../config/supabase';

export type ActivityAction =
  | 'APP_LAUNCHED'
  | 'SCREEN_VIEW'
  | 'AC_POWER_TOGGLED'
  | 'TEMP_CHANGED'
  | 'MODE_CHANGED'
  | 'FAN_SPEED_CHANGED'
  | 'ADD_DEVICE_CLICKED'
  | 'DEVICE_ADDED'
  | 'DEVICE_REMOVED'
  | 'NETWORK_SCAN_STARTED';

export type ErrorType =
  | 'GREE_UDP_TIMEOUT'
  | 'TUYA_LOCAL_KEY_MISSING'
  | 'TUYA_SOCKET_FAILED'
  | 'NETWORK_UNREACHABLE'
  | 'DEVICE_OFFLINE'
  | 'AUTH_FAILED'
  | 'UNHANDLED_EXCEPTION';

class TelemetryLogger {
  private userId: string = 'user-app';

  setUserId(id: string) {
    this.userId = id;
  }

  async logActivity(
    action: ActivityAction,
    deviceName?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      await supabase.from('user_activity').insert({
        user_id: this.userId,
        action,
        device_name: deviceName || null,
        details,
      });
    } catch (err) {
      // Never let telemetry disrupt UI execution
      console.warn('Activity log failed:', err);
    }
  }

  async logError(
    errorType: ErrorType,
    message: string,
    deviceBrand?: string,
    deviceIp?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await supabase.from('error_logs').insert({
        user_id: this.userId,
        error_type: errorType,
        message,
        device_brand: deviceBrand || null,
        device_ip: deviceIp || null,
        platform: 'Android',
        metadata,
      });
    } catch (err) {
      console.warn('Error log failed:', err);
    }
  }
}

export const logger = new TelemetryLogger();
