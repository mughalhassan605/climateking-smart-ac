import React from 'react';
import { Pressable, ScrollView, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { spacing as spacingTokens, radius as radiusTokens } from '../theme/tokens';
import { ChevronLeftIcon } from './icons';
import { Text } from './Text';

type SpaceKey = keyof typeof spacingTokens;

export function Spacer({ size = 'lg', horizontal = false }: { size?: SpaceKey; horizontal?: boolean }) {
  const value = spacingTokens[size];
  return <View style={horizontal ? { width: value } : { height: value }} />;
}

type StackProps = {
  children?: React.ReactNode;
  gap?: SpaceKey;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  flex?: number;
  direction?: 'row' | 'column';
  style?: ViewStyle | ViewStyle[];
};

export function Stack({ children, gap = 'none', align, justify, wrap, flex, direction = 'column', style }: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap: spacingTokens[gap],
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : undefined,
          flex,
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}

export const Row = (props: Omit<StackProps, 'direction'>) => <Stack {...props} direction="row" />;

type CardProps = {
  children?: React.ReactNode;
  padding?: SpaceKey;
  radius?: keyof typeof radiusTokens;
  style?: ViewStyle | ViewStyle[];
};

export function Card({ children, padding = 'lg', radius = 'lg', style }: CardProps) {
  const { theme } = useUnistyles();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          padding: spacingTokens[padding],
          borderRadius: radiusTokens[radius],
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}

type ScreenProps = {
  children?: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: { top?: boolean; bottom?: boolean };
  contentStyle?: ViewStyle;
};

export function Screen({ children, scroll = false, padded = true, edges = { top: true, bottom: false }, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  styles.useVariants({ padded });
  const safe = {
    paddingTop: edges.top ? insets.top : 0,
    paddingBottom: edges.bottom ? insets.bottom : 0,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };
  if (scroll) {
    return (
      <View style={[styles.root, safe]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.grow, styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={[styles.root, safe]}>
      <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

type HeaderProps = { title?: string; onBack?: () => void; right?: React.ReactNode; backLabel?: string };

export function ScreenHeader({ title, onBack, right, backLabel = 'Back' }: HeaderProps) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ChevronLeftIcon size={26} color={theme.colors.textPrimary} />
        </Pressable>
      ) : null}
      <Text variant="title" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  content: {
    variants: {
      padded: {
        true: { paddingHorizontal: theme.spacing.xl },
        false: {},
      },
    },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  back: { marginLeft: -theme.spacing.xs },
  pressed: { opacity: 0.6 },
  title: { flex: 1 },
  right: { marginLeft: theme.spacing.sm },
}));
