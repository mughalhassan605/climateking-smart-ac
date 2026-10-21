import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ChevronRightIcon, MessageIcon, PlusIcon } from '../../components/icons';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import type { Device } from '../devices/types';

export function HomeHeader({
  greeting,
  homeName,
  onAdd,
  onOpenMessages,
  hasUnreadMessages,
}: {
  greeting: string;
  homeName: string;
  onAdd: () => void;
  onOpenMessages: () => void;
  hasUnreadMessages: boolean;
}) {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <View style={styles.titleCol}>
        <Text variant="caption" tone="muted">
          {greeting}
        </Text>
        <Text variant="titleLg" numberOfLines={1}>
          {homeName}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onOpenMessages}
          accessibilityRole="button"
          accessibilityLabel={t(hasUnreadMessages ? 'home.messagesUnread' : 'home.messages')}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <MessageIcon size={22} color={theme.colors.textSecondary} />
          {hasUnreadMessages ? <View style={[styles.badge, { borderColor: theme.colors.surfaceMuted }]} /> : null}
        </Pressable>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('devices.addDeviceShort')}
          style={({ pressed }) => [styles.iconBtn, styles.addBtn, pressed && styles.pressed]}
        >
          <PlusIcon size={22} color={theme.colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

export type Promo = { id: string; titleKey: string; bodyKey: string; ctaKey: string; image: string };

export const PRODUCT_IMAGE = {
  airdeckPro: 'https://shop.climateking.eu/wp-content/uploads/2026/02/Climate-King-Airdeck-Pro-detailweergave-600x338.jpg',
  airdeckProSquare: 'https://shop.climateking.eu/wp-content/uploads/2026/02/Climate-King-Airdeck-Pro-detailweergave-300x300.jpg',
};

export const welcomePromo: Promo = {
  id: 'welcome',
  titleKey: 'home.promoTitle',
  bodyKey: 'home.promoBody',
  ctaKey: 'home.promoCta',
  image: PRODUCT_IMAGE.airdeckProSquare,
};

export function PromoBanner({ promo, onPress }: { promo: Promo; onPress: () => void }) {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const title = t(promo.titleKey);
  const body = t(promo.bodyKey);
  const cta = t(promo.ctaKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}. ${cta}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.copy}>
        <Text variant="heading" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {body}
        </Text>
        <View style={styles.ctaRow}>
          <Text variant="label" tone="accent">
            {cta}
          </Text>
          <ChevronRightIcon size={16} color={theme.colors.accent} />
        </View>
      </View>
      <Image source={{ uri: promo.image }} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
    </Pressable>
  );
}

function Stat({ value, label, tone = 'base' }: { value: number; label: string; tone?: 'base' | 'brand' }) {
  return (
    <View style={styles.stat}>
      <Text variant="displayLg" tone={tone} style={styles.value}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export function SummaryStrip({ devices }: { devices: Device[] }) {
  const { t } = useI18n();
  const running = devices.filter(d => d.isOn && d.status !== 'offline').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  return (
    <View style={styles.summary}>
      <Stat value={running} label={t('home.statRunning')} tone="brand" />
      <View style={styles.divider} />
      <Stat value={devices.length} label={t('home.statDevices')} />
      <View style={styles.divider} />
      <Stat value={offline} label={t('home.statOffline')} />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  titleCol: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    backgroundColor: theme.colors.danger,
  },
  addBtn: { backgroundColor: theme.colors.primary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.radius.xl2,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.92 },
  copy: { flex: 1, gap: theme.spacing.xs },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs, marginTop: theme.spacing.xs },
  image: { width: 116, height: 96 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    paddingVertical: theme.spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  value: { fontSize: 30, lineHeight: 34 },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.border,
  },
}));
