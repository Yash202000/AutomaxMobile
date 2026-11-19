// KFF Dispatcher palette — taken from the KFF design (primary #4D77FF and the
// #F4F6FC map background come straight from the supplied SVG assets).
// Only KFF screens/components use this; other clients keep their own COLORS.
export const KFF_COLORS = {
  primary: '#4D77FF',
  primarySoft: '#E3E8FB',
  primaryRing: '#D5DCF5',
  navy: '#1E2B5E',
  background: '#F4F6FC',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  divider: '#C9D0E6',
  white: '#FFFFFF',
  online: '#4CAF50',
  busy: '#F59E0B',
  offline: '#9CA3AF',
  danger: '#E74C3C',
  // Activity / status colours
  accepted: '#5E9E78',
  completed: '#4596C1',
  rejected: '#A9A8E3',
  assigned: '#E5B53A',
  inProgress: '#4D77FF',
};

export const KFF_CRITICALITY_COLORS: Record<string, string> = {
  low: '#C0501A',
  medium: '#E5A00D',
  high: '#E67E22',
  critical: '#E74C3C',
};

// Card shadows shared by the KFF screens (navy tint).
export const KFF_SHADOWS = {
  card: {
    shadowColor: KFF_COLORS.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  soft: {
    shadowColor: KFF_COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
};
