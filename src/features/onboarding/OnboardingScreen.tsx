import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, useWindowDimensions, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { Spacer } from '../../components/layout';
import { Text } from '../../components/Text';
import { useI18n } from '../../i18n';
import { StorageKeys, storage } from '../../lib/storage';
import type { AuthStackParams } from '../../navigation/types';
import { ClimateHubArt, FamilyHomeArt, RemoteReachArt } from './art';

const ONBOARDING_SLIDES = [
  { id: 'control', Art: ClimateHubArt, eyebrowKey: 'onboarding.slide1Eyebrow', titleKey: 'onboarding.slide1Title', descriptionKey: 'onboarding.slide1Desc' },
  { id: 'remote', Art: RemoteReachArt, eyebrowKey: 'onboarding.slide2Eyebrow', titleKey: 'onboarding.slide2Title', descriptionKey: 'onboarding.slide2Desc' },
  { id: 'family', Art: FamilyHomeArt, eyebrowKey: 'onboarding.slide3Eyebrow', titleKey: 'onboarding.slide3Title', descriptionKey: 'onboarding.slide3Desc' },
] as const;

export const hasCompletedOnboarding = () => storage.getBoolean(StorageKeys.onboardingComplete) === true;
export const markOnboardingComplete = () => storage.setBoolean(StorageKeys.onboardingComplete, true);

type Slide = (typeof ONBOARDING_SLIDES)[number];

function OnboardingSlide({ slide, width }: { slide: Slide; width: number }) {
  const { t } = useI18n();
  const { Art } = slide;
  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.artArea}>
        <Art size={Math.min(width * 0.74, 300)} />
      </View>
      <View style={styles.copy}>
        <Text variant="overline" tone="accent" center>
          {t(slide.eyebrowKey)}
        </Text>
        <Text variant="display" center>
          {t(slide.titleKey)}
        </Text>
        <Text variant="body" tone="secondary" center>
          {t(slide.descriptionKey)}
        </Text>
      </View>
    </View>
  );
}

function Pagination({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </View>
  );
}

function Dot({ active }: { active: boolean }) {
  styles.useVariants({ active });
  return <View style={styles.dot} />;
}

export function OnboardingScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParams>>();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const isLast = index === ONBOARDING_SLIDES.length - 1;

  const go = useCallback(
    (route: 'Login' | 'Register') => {
      markOnboardingComplete();
      navigation.navigate(route);
    },
    [navigation],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== index) setIndex(next);
    },
    [index, width],
  );

  return (
    <View style={styles.root}>
      <View style={styles.backdrop} pointerEvents="none" />
      <View style={styles.header} pointerEvents="auto">
        <Pressable
          onPress={() => go('Login')}
          hitSlop={12}
          accessibilityRole="button"
          disabled={isLast}
          style={[styles.skip, isLast && styles.skipHidden]}
        >
          <Text variant="label" tone="secondary">
            {t('common.skip')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.carousel}>
        <FlatList
          ref={listRef}
          data={ONBOARDING_SLIDES}
          keyExtractor={s => s.id}
          renderItem={({ item }) => <OnboardingSlide slide={item} width={width} />}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        />
      </View>
      <View style={styles.footer}>
        <Pagination count={ONBOARDING_SLIDES.length} index={index} />
        <Spacer size="xl2" />
        <View style={styles.actions}>
          <View style={styles.actionItem}>
            <Button label={t('onboarding.register')} fullWidth onPress={() => go('Register')} />
          </View>
          <View style={styles.actionItem}>
            <Button label={t('onboarding.signIn')} variant="secondary" fullWidth onPress={() => go('Login')} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom,
  },
  backdrop: {
    position: 'absolute',
    top: -rt.screen.width * 0.5,
    alignSelf: 'center',
    width: rt.screen.width * 1.4,
    height: rt.screen.width * 1.4,
    borderRadius: rt.screen.width * 0.7,
    backgroundColor: theme.colors.primaryMuted,
    opacity: 0.5,
  },
  header: { height: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.xl2 },
  carousel: { flex: 1 },
  skip: { alignSelf: 'flex-end', paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.sm },
  skipHidden: { opacity: 0 },
  footer: { paddingHorizontal: theme.spacing.xl2, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  actions: { flexDirection: 'row', gap: theme.spacing.md },
  actionItem: { flex: 1 },
  slide: { flex: 1, paddingHorizontal: theme.spacing.xl2 },
  artArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    opacity: 0.3,
    variants: {
      active: {
        true: { width: 26, opacity: 1 },
        false: {},
      },
    },
  },
}));
