import type { ThemeFamily, ThemePolarity } from '@brewsite/core';
import type { DeckTheme } from './types';

type DeckThemePair = {
  readonly dark: DeckTheme;
  readonly light: DeckTheme;
};

const withSharedDeckTokens = (theme: DeckTheme): DeckTheme => ({
  ...theme,
  spacing: { slide: '8%', stack: '1.5rem' },
  border: { radius: '0.5rem' },
});

const _defaultPair: DeckThemePair = {
    dark: withSharedDeckTokens({
      fonts: { heading: '"Inter", sans-serif', body: '"Inter", sans-serif' },
      colorMode: 'dark',
      accentColor: '#4F76B8',
      background: { color: '#0A1424', gradient: 'linear-gradient(180deg, #0A1424 0%, #15253A 100%)' },
      colors: { heading: '#E5EEFA', body: '#A8B8CF', surface: '#1E324F', muted: '#5A6D86' },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
    light: withSharedDeckTokens({
      fonts: { heading: '"Inter", sans-serif', body: '"Inter", sans-serif' },
      colorMode: 'light',
      accentColor: '#5E7EA9',
      background: { color: '#F3F6FA', gradient: 'linear-gradient(180deg, #F3F6FA 0%, #E7EDF5 100%)' },
      colors: { heading: '#1F334E', body: '#5A6D86', surface: '#FFFFFF', muted: '#A8B8CF' },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
};

export const DECK_THEME_PAIRS: Record<ThemeFamily, DeckThemePair> = {
  default:    _defaultPair,
  enterprise: _defaultPair,
  darkGlass: {
    dark: withSharedDeckTokens({
      fonts: { heading: '"Sora", "Inter", sans-serif', body: '"Sora", "Inter", sans-serif' },
      colorMode: 'dark',
      accentColor: '#B33A2B',
      background: {
        color: '#070504',
        gradient: 'linear-gradient(180deg, #070504 0%, #130B08 100%)',
      },
      colors: {
        heading: '#F2E6DE',
        body: '#B79B8F',
        surface: '#1E1412',
        muted: '#6E5750',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
    light: withSharedDeckTokens({
      fonts: { heading: '"Sora", "Inter", sans-serif', body: '"Sora", "Inter", sans-serif' },
      colorMode: 'light',
      accentColor: '#E36A2E',
      background: {
        color: '#F8F3EF',
        gradient: 'linear-gradient(180deg, #F8F3EF 0%, #EFE6DE 100%)',
      },
      colors: {
        heading: '#2B1F1A',
        body: '#6E5750',
        surface: '#FFF9F5',
        muted: '#B79B8F',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
  },
  midnight: {
    dark: withSharedDeckTokens({
      fonts: { heading: '"Manrope", "Source Sans 3", sans-serif', body: '"Manrope", "Source Sans 3", sans-serif' },
      colorMode: 'dark',
      accentColor: '#E2A33A',
      background: {
        color: '#0D0907',
        gradient: 'linear-gradient(180deg, #0D0907 0%, #1A120D 100%)',
      },
      colors: {
        heading: '#F2E7D4',
        body: '#BCA180',
        surface: '#261A13',
        muted: '#7B664C',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
    light: withSharedDeckTokens({
      fonts: { heading: '"Manrope", "Source Sans 3", sans-serif', body: '"Manrope", "Source Sans 3", sans-serif' },
      colorMode: 'light',
      accentColor: '#A7793A',
      background: {
        color: '#FAF6EE',
        gradient: 'linear-gradient(180deg, #FAF6EE 0%, #F1E7D8 100%)',
      },
      colors: {
        heading: '#3A2A1B',
        body: '#7B664C',
        surface: '#FFF9EE',
        muted: '#BCA180',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
  },
  neonCyber: {
    dark: withSharedDeckTokens({
      fonts: { heading: '"Space Grotesk", "Rajdhani", sans-serif', body: '"Space Grotesk", "Rajdhani", sans-serif' },
      colorMode: 'dark',
      accentColor: '#8A3DFF',
      background: {
        color: '#02030D',
        gradient: 'linear-gradient(180deg, #02030D 0%, #09122A 100%)',
      },
      colors: {
        heading: '#D8CCFF',
        body: '#9688D6',
        surface: '#0C183A',
        muted: '#516498',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
    light: withSharedDeckTokens({
      fonts: { heading: '"Space Grotesk", "Rajdhani", sans-serif', body: '"Space Grotesk", "Rajdhani", sans-serif' },
      colorMode: 'light',
      accentColor: '#11C9E8',
      background: {
        color: '#F5F8FF',
        gradient: 'linear-gradient(180deg, #F5F8FF 0%, #EAF2FF 100%)',
      },
      colors: {
        heading: '#1E2F5A',
        body: '#516498',
        surface: '#F8FBFF',
        muted: '#9688D6',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
  },
  lightCanvas: {
    dark: withSharedDeckTokens({
      fonts: { heading: '"Plus Jakarta Sans", "Inter", sans-serif', body: '"Plus Jakarta Sans", "Inter", sans-serif' },
      colorMode: 'dark',
      accentColor: '#3D63D9',
      background: {
        color: '#131923',
        gradient: 'linear-gradient(180deg, #131923 0%, #1C2533 100%)',
      },
      colors: {
        heading: '#E8EEF7',
        body: '#A8B4C4',
        surface: '#232F40',
        muted: '#5F7088',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
    light: withSharedDeckTokens({
      fonts: { heading: '"Plus Jakarta Sans", "Inter", sans-serif', body: '"Plus Jakarta Sans", "Inter", sans-serif' },
      colorMode: 'light',
      accentColor: '#4768C9',
      background: {
        color: '#FFFFFF',
        gradient: 'linear-gradient(180deg, #FFFFFF 0%, #F1F4F8 100%)',
      },
      colors: {
        heading: '#1D2A3D',
        body: '#5F7088',
        surface: '#FFFFFF',
        muted: '#A8B4C4',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
  },
  lightMinimal: {
    dark: withSharedDeckTokens({
      fonts: { heading: '"Inter", "Source Sans 3", sans-serif', body: '"Inter", "Source Sans 3", sans-serif' },
      colorMode: 'dark',
      accentColor: '#7FAEEA',
      background: {
        color: '#101317',
        gradient: 'linear-gradient(180deg, #101317 0%, #191E24 100%)',
      },
      colors: {
        heading: '#E8EDF5',
        body: '#A8B2C2',
        surface: '#252C35',
        muted: '#6E7D92',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
    light: withSharedDeckTokens({
      fonts: { heading: '"Inter", "Source Sans 3", sans-serif', body: '"Inter", "Source Sans 3", sans-serif' },
      colorMode: 'light',
      accentColor: '#6A94CD',
      background: {
        color: '#FFFFFF',
        gradient: 'linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)',
      },
      colors: {
        heading: '#223248',
        body: '#6E7D92',
        surface: '#F3F6FB',
        muted: '#A8B2C2',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
    }),
  },
};

export function getDeckThemeForFamily(family: ThemeFamily, polarity: ThemePolarity): DeckTheme {
  return DECK_THEME_PAIRS[family][polarity];
}

export function createDeckThemeForFamily(family: ThemeFamily, polarity: ThemePolarity): DeckTheme {
  const theme = DECK_THEME_PAIRS[family][polarity];
  return {
    ...theme,
    fonts: { ...theme.fonts },
    background: { ...theme.background },
    colors: { ...theme.colors },
    spacing: { ...theme.spacing },
    border: { ...(theme.border ?? { radius: '0.5rem' }) },
  };
}
