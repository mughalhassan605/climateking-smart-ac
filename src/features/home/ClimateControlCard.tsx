import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  AutoIcon,
  DropletIcon,
  FanIcon,
  FlameIcon,
  IconProps,
  MinusIcon,
  PlusIcon,
  PowerIcon,
  SnowflakeIcon,
} from '../../components/icons';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import { clampTemp, useDevicePatch, useToggleDevicePower } from '../devices/hooks';
import { Device, Mode, MODE_LABEL_KEY, MODE_LABEL_SHORT_KEY, formatTemp, modeColor, TEMP_RANGE } from '../devices/types';
import { useRoomLabel } from '../rooms/useRoomLabel';

const MODE_ICON: Record<Mode, React.ComponentType<IconProps>> = {
  cool: SnowflakeIcon,
  heat: FlameIcon,
  dry: DropletIcon,
  fan: FanIcon,
  auto: AutoIcon,
};

// On-tint foreground colours for an active card (original module 1455 constants).
const ON_FG = '#FFFFFF';
const ON_FG_MUTED = 'rgba(255,255,255,0.78)';
const ON_BORDER = 'rgba(255,255,255,0.16)';
const ON_SURFACE = 'rgba(255,255,255,0.30)';

export function ClimateControlCard({
  device,
  compact = false,
  onPress,
}: {
  device: Device;
  compact?: boolean;
  onPress?: (device: Device) => void;
}) {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const roomLabel = useRoomLabel();
  const toggle = useToggleDevicePower();
  const patch = useDevicePatch();

  const offline = device.status === 'offline';
  const active = device.isOn && !offline;
  const tint = modeColor(theme, device.mode);
  const ModeIcon = MODE_ICON[device.mode];

  styles.useVariants({ compact, dim: offline });
  const press = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const wasActive = useRef(active);

  // A soft pop when the unit turns on, exactly like the original.
  useEffect(() => {
    if (active && !wasActive.current) {
      Animated.sequence([
        Animated.spring(press, { toValue: 1.035, damping: 10, stiffness: 150, mass: 1, useNativeDriver: true }),
        Animated.spring(press, { toValue: 1, damping: 13, stiffness: 150, mass: 1, useNativeDriver: true }),
      ]).start();
    }
    wasActive.current = active;
  }, [active, press]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.18, duration: 110, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start();
  }, [device.targetTemp, pulse]);

  const fg = active ? ON_FG : theme.colors.textPrimary;
  const fgMuted = active ? ON_FG_MUTED : theme.colors.textMuted;
  const modeLabelKey = compact ? MODE_LABEL_SHORT_KEY[device.mode] : MODE_LABEL_KEY[device.mode];
  const status = offline ? t('device.offline') : device.isOn ? t(modeLabelKey) : t('common.off');
  const tempText = offline ? '—' : formatTemp(device.targetTemp);

  const changeTemp = (delta: number) => {
    const next = clampTemp(device.targetTemp + delta);
    if (next !== device.targetTemp) patch.mutate({ id: device.id, patch: { targetTemp: next } });
  };

  const pressSpring = (to: number) =>
    Animated.spring(press, { toValue: to, damping: 16, stiffness: 220, mass: 1, useNativeDriver: true }).start();

  const canLower = device.targetTemp > TEMP_RANGE.min;
  const canRaise = device.targetTemp < TEMP_RANGE.max;

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('device.cardA11y', { name: device.name, status, temp: tempText })}
        onPress={() => onPress?.(device)}
        onPressIn={() => pressSpring(0.97)}
        onPressOut={() => pressSpring(1)}
        style={[styles.card, { backgroundColor: active ? tint : theme.colors.surface }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleCol}>
            <Text variant="heading" numberOfLines={1} style={{ color: fg }}>
              {device.name}
            </Text>
            <Text variant="caption" numberOfLines={1} style={{ color: fgMuted }}>
              {device.awaitingVendor ? t('device.awaitingVendor') : roomLabel(device.roomName)}
            </Text>
          </View>
          <Pressable
            onPress={() => toggle.toggle(device, !device.isOn)}
            disabled={offline}
            accessibilityRole="switch"
            accessibilityState={{ checked: device.isOn, disabled: offline }}
            accessibilityLabel={t('device.togglePowerA11y', { name: device.name, state: t(device.isOn ? 'common.off' : 'common.on') })}
            style={({ pressed }) => [
              styles.power,
              { borderColor: active ? ON_BORDER : theme.colors.borderStrong, backgroundColor: active ? ON_SURFACE : 'transparent' },
              pressed && styles.powerPressed,
            ]}
          >
            <PowerIcon size={compact ? 18 : 20} color={active ? ON_FG : theme.colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Animated.Text style={[compact ? styles.bigTempCompact : styles.bigTemp, { color: fg, transform: [{ scale: pulse }] }]}>
            {tempText}
          </Animated.Text>
          <View style={styles.modeChip}>
            <ModeIcon size={compact ? 16 : 18} color={active ? ON_FG : theme.colors.textSecondary} />
            <Text variant="label" numberOfLines={1} style={[styles.modeLabel, { color: fgMuted }]}>
              {t(modeLabelKey)}
            </Text>
          </View>
        </View>

        {!compact ? (
          <View style={[styles.stepper, { borderColor: active ? ON_BORDER : theme.colors.border, backgroundColor: active ? ON_SURFACE : 'transparent' }]}>
            <Pressable
              onPress={() => changeTemp(-1)}
              disabled={offline || !canLower}
              accessibilityRole="button"
              accessibilityLabel={t('device.lowerTemp')}
              style={[styles.stepBtn, (offline || !canLower) && styles.stepDim]}
            >
              <MinusIcon size={22} color={fg} />
            </Pressable>
            <Text variant="title" style={{ color: fg }}>
              {tempText}
            </Text>
            <Pressable
              onPress={() => changeTemp(1)}
              disabled={offline || !canRaise}
              accessibilityRole="button"
              accessibilityLabel={t('device.raiseTemp')}
              style={[styles.stepBtn, (offline || !canRaise) && styles.stepDim]}
            >
              <PlusIcon size={22} color={fg} />
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create(theme => ({
  card: {
    borderRadius: theme.radius.xl2,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    variants: {
      compact: {
        true: { padding: theme.spacing.md, gap: theme.spacing.md },
        false: {},
      },
      dim: {
        true: { opacity: 0.6 },
        false: {},
      },
    },
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm },
  titleCol: { flex: 1, gap: 2 },
  power: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    variants: {
      compact: {
        true: { width: 34, height: 34 },
        false: {},
      },
    },
  },
  powerPressed: { opacity: 0.7 },
  hero: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: theme.spacing.sm },
  bigTemp: { flexShrink: 0, fontSize: 52, lineHeight: 56, fontWeight: '700', letterSpacing: -1.5 },
  bigTempCompact: { flexShrink: 0, fontSize: 34, lineHeight: 38, fontWeight: '700', letterSpacing: -1 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingBottom: theme.spacing.xs, flexShrink: 1, minWidth: 0 },
  modeLabel: { flexShrink: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.xs,
  },
  stepBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepDim: { opacity: 0.45 },
}));
