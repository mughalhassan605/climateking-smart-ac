import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CheckIcon, SaveIcon, SearchIcon } from '../../components/icons';
import { Spacer } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import type { AuthStackParams } from '../../navigation/types';
import { COUNTRIES } from '../homes/countries';
import { AuthHeader } from './components';

type Country = (typeof COUNTRIES)[number];

function CountryRow({ country, selected, onPress }: { country: Country; selected: boolean; onPress: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Text variant="body" tone={selected ? 'accent' : 'base'}>
        {country.name}
      </Text>
      {selected ? <CheckIcon size={20} color={theme.colors.accent} /> : null}
    </Pressable>
  );
}

export function RegionSelectScreen() {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParams>>();
  const { params } = useRoute<RouteProp<AuthStackParams, 'RegionSelect'>>();
  const [query, setQuery] = useState('');

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COUNTRIES.filter(c => c.name.toLowerCase().includes(q)) : COUNTRIES;
  }, [query]);

  // The original hands back the country *name*; Register sends it to the server as `region`.
  const pick = (country: Country) => {
    navigation.navigate(params.returnTo, { region: country.name }, { merge: true });
  };

  return (
    <View style={styles.root}>
      <View style={styles.padded}>
        <AuthHeader
          title={t('auth.selectRegion')}
          onBack={() => navigation.goBack()}
          right={
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.done')}>
              <SaveIcon size={24} color={theme.colors.textPrimary} />
            </Pressable>
          }
        />
        <Spacer size="lg" />
        <View style={styles.search}>
          <SearchIcon size={20} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('common.search')}
            placeholderTextColor={theme.colors.textMuted}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <Spacer size="sm" />
      </View>
      <FlatList
        data={data}
        keyExtractor={item => item.code}
        renderItem={({ item }) => <CountryRow country={item} selected={item.name === params.selected} onPress={() => pick(item)} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  root: { flex: 1, backgroundColor: theme.colors.background, paddingTop: rt.insets.top + theme.spacing.sm },
  padded: { paddingHorizontal: theme.spacing.xl },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.lg,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.families.body,
    fontSize: theme.typography.sizes.base,
  },
  listContent: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowPressed: { opacity: 0.6 },
}));
