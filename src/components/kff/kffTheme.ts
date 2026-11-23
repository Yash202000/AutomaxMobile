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
  closed: '#7D8BA6',
  enRoute: '#E8924A',
  reached: '#3AA99F',
  assigned: '#E5B53A',
  inProgress: '#4D77FF',
};

/**
 * One colour per incident state — the state badge on incident cards (list and
 * detail) and the Profile activity cards (by list status).
 */
export const KFF_STATE_COLORS = {
  assigned: '#E3A21A', // waiting for Accept / Reject
  accepted: '#EF7D22', // Dispatched — orange
  inProgress: '#4D77FF',
  enRoute: '#F5AA66', // light orange
  reached: '#62AAE6', // light blue
  completed: '#2F73C9', // blue
  closed: '#A0A7B6', // greyed out
  rejected: '#E04B4B', // red
} as const;

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
