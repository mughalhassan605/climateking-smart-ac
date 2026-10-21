import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { EmptyState } from '../../components/feedback';
import { Screen } from '../../components/layout';
import { Spacer } from '../../components/layout';
import { useI18n } from '../../i18n';
import type { DeviceStackParams } from '../../navigation/types';
import { useBridges, useDeviceRealtime, useDevices } from '../devices/hooks';
import type { Device } from '../devices/types';
import { useRooms } from '../rooms/rooms';
import { BridgeStatusBanner, HomeHeader, SummaryStrip } from './HomeParts';
import { ClimateControlCard } from './ClimateControlCard';
import { buildRoomTabs, Layout, RoomTabs } from './RoomTabs';
import { useHome } from '../homes/homes';
import { useUnreadMessageCount } from '../messages/messages';

export function HomeScreen() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<DeviceStackParams>>();
  const { home, greeting } = useHome();
  const devicesQ = useDevices();
  const bridgesQ = useBridges();
  useDeviceRealtime();
  const roomsQ = useRooms();
  const unread = useUnreadMessageCount();

  const [roomFilter, setRoomFilter] = useState('all');
  const [layout, setLayout] = useState<Layout>('grid');

  const devices = devicesQ.data ?? [];
  const roomTabs = useMemo(() => buildRoomTabs(roomsQ.data ?? [], t), [roomsQ.data, t]);
  const shown = roomFilter === 'all' ? devices : devices.filter(d => d.roomId === roomFilter);

  const openDevice = (device: Device) => navigation.navigate('DeviceControl', { deviceId: device.id });
  const grid = layout === 'grid';

  const header = (
    <View>
      <BridgeStatusBanner bridges={bridgesQ.data} onPress={() => navigation.navigate('AddDevice')} />
      <Spacer size="lg" />
      <SummaryStrip devices={devices} />
      <Spacer size="lg" />
      <RoomTabs
        rooms={roomTabs}
        active={roomFilter}
        onSelect={setRoomFilter}
        layout={layout}
        onToggleLayout={() => setLayout(l => (l === 'grid' ? 'list' : 'grid'))}
        onManageRooms={() => navigation.navigate('RoomManagement')}
      />
      <Spacer size="md" />
    </View>
  );

  const empty = (
    <EmptyState
      title={devices.length ? t('home.noDevicesInRoom') : t('home.noDevicesTitle', { name: home.name })}
      description={devices.length ? undefined : t('home.noDevicesDesc')}
      actionLabel={t('devices.addDeviceShort')}
      onAction={() => navigation.navigate('AddDevice')}
    />
  );

  return (
    <Screen padded={false} edges={{ top: true, bottom: false }}>
      <View style={styles.header}>
        <HomeHeader
          greeting={greeting}
          homeName={home.name}
          onAdd={() => navigation.navigate('AddDevice')}
          onOpenMessages={() => navigation.navigate('Messages')}
          hasUnreadMessages={unread > 0}
        />
      </View>
      <FlatList
        key={layout}
        data={shown}
        keyExtractor={d => d.id}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={grid ? styles.gridRow : undefined}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => (
          <View style={grid ? styles.cellGrid : styles.cellList}>
            <ClimateControlCard device={item} compact={grid} onPress={openDevice} />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={devicesQ.isFetching} onRefresh={() => devicesQ.refetch()} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create(theme => ({
  header: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.md },
  listContent: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl4, flexGrow: 1 },
  gridRow: { gap: theme.spacing.sm },
  cellGrid: { flex: 1, paddingBottom: theme.spacing.md, minWidth: 0 },
  cellList: { paddingBottom: theme.spacing.md },
}));
