import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type TextVariant =
  | 'displayLg'
  | 'display'
  | 'titleLg'
  | 'title'
  | 'heading'
  | 'numeric'
  | 'body'
  | 'bodySm'
  | 'label'
  | 'caption'
  | 'overline';

export type TextTone =
  | 'base'
  | 'secondary'
  | 'muted'
  | 'inverse'
  | 'onPrimary'
  | 'brand'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning';

type Props = TextProps & { variant?: TextVariant; tone?: TextTone; center?: boolean };

export function Text({ variant = 'body', tone = 'base', center = false, style, ...rest }: Props) {
  styles.useVariants({ variant, tone, center });
  return <RNText {...rest} style={[styles.text, style]} />;
}

const styles = StyleSheet.create(theme => ({
  text: {
    color: theme.colors.textPrimary,
    variants: {
      variant: theme.typography.variants,
      tone: {
        base: { color: theme.colors.textPrimary },
        secondary: { color: theme.colors.textSecondary },
        muted: { color: theme.colors.textMuted },
        inverse: { color: theme.colors.textInverse },
        onPrimary: { color: theme.colors.onPrimary },
        brand: { color: theme.colors.primary },
        accent: { color: theme.colors.accent },
        danger: { color: theme.colors.danger },
        success: { color: theme.colors.success },
        warning: { color: theme.colors.warning },
      },
      center: {
        true: { textAlign: 'center' },
        false: {},
      },
    },
  },
}));
