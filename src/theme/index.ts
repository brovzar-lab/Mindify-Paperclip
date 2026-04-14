// ADHD-friendly defaults: muted palette, generous whitespace, soft contrasts.
// WS1 design pass will refine — values here are placeholders sized to feel
// reasonable in the simulator, not final.

export const theme = {
  colors: {
    background: '#faf8f4',
    surface: '#ffffff',
    surfaceMuted: '#f3efe8',
    text: '#2b2a28',
    textMuted: '#6b6863',
    textSubtle: '#9a958e',
    divider: '#e8e3d8',
    accent: '#7a9fd1',
    accentMuted: '#dde6f1',
    record: '#d97778',
    recordActive: '#c5605f',
    success: '#7fa890',
    urgencyHigh: '#d97778',
    urgencyMed: '#e8b870',
    urgencyLow: '#c2c2bc',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radii: { sm: 6, md: 12, lg: 20, pill: 999 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, display: 40 },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export type Theme = typeof theme;
