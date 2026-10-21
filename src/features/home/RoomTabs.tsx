import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { GridIcon, ListIcon, SlidersIcon } from '../../components/icons';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import type { Room } from '../rooms/rooms';

export type RoomTab = { id: string; label: string };
export type Layout = 'grid' | 'list';

export function buildRoomTabs(rooms: Room[], t: (k: string) => string): RoomTab[] {
  const sorted = [...rooms].sort((a, b) => a.order - b.order);
  return [
    { id: 'all', label: t('common.all') },
    ...sorted.map(r => ({ id: r.id, label: r.nameKey ? t(r.nameKey) : r.name })),
  ];
}

export function RoomTabs({
  rooms,
  active,
  onSelect,
  layout,
  onToggleLayout,
  onManageRooms,
}: {
  rooms: RoomTab[];
  active: string;
  onSelect: (id: string) => void;
  layout: Layout;
  onToggleLayout: () => void;
  onManageRooms: () => void;
}) {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <View style={styles.scrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.track}>
            {rooms.map(tab => {
              const selected = tab.id === active;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => onSelect(tab.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[styles.tab, selected && { backgroundColor: theme.colors.primary }]}
                >
                  <Text variant="label" tone={selected ? 'onPrimary' : 'secondary'} style={styles.tabLabel}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
      <View style={styles.controls}>
        <Pressable
          onPress={onToggleLayout}
          accessibilityRole="button"
          accessibilityLabel={t(layout === 'grid' ? 'home.switchToList' : 'home.switchToGrid')}
          style={styles.ctrlBtn}
        >
          {layout === 'grid' ? (
            <ListIcon size={20} color={theme.colors.textSecondary} />
          ) : (
            <GridIcon size={20} color={theme.colors.textSecondary} />
          )}
        </Pressable>
        <View style={styles.divider} />
        <Pressable onPress={onManageRooms} accessibilityRole="button" accessibilityLabel={t('home.manageRooms')} style={styles.ctrlBtn}>
          <SlidersIcon size={20} color={theme.colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  scrollWrap: { flex: 1 },
  scroll: { paddingRight: theme.spacing.xl },
  track: { flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' },
  tab: {
    height: 38,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: { textTransform: 'capitalize', textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.pill },
  ctrlBtn: { width: 40, height: 40, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: theme.spacing.xl, backgroundColor: theme.colors.borderStrong },
}));
