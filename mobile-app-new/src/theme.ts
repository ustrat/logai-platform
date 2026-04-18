// Matches the web app's CSS variable palette (index.css)
export const Colors = {
  // Backgrounds
  bgBase:     '#f0f4f8',
  bgSurface:  '#ffffff',
  bgElevated: '#e8eef5',
  bgHover:    '#dde6f0',
  navy:       '#1e3a5f',

  // Borders
  border:       '#d1dae4',
  borderBright: '#b0bec9',

  // Accent
  amber:    '#f59e0b',
  amberDim: 'rgba(245,158,11,0.15)',

  // Status
  red:      '#dc2626',
  redDim:   'rgba(220,38,38,0.1)',
  green:    '#16a34a',
  greenDim: 'rgba(22,163,74,0.1)',
  blue:     '#1d4ed8',
  blueDim:  'rgba(29,78,216,0.1)',

  // Text
  textPrimary:   '#111827',
  textSecondary: '#374151',
  textMuted:     '#6b7280',
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#16a34a',
};
