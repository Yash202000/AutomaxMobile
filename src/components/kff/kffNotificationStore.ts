import { useSyncExternalStore } from 'react';

import { fetchKffNotifications, markKffNotificationRead } from '@/src/api/kffNotifications';

// KFF notification inbox (module-level store, no provider needed): the New
// Incidents list and the app-bar bell badge read the same state.

interface KffNotificationsState {
  items: any[];
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  page: number;
  totalPages: number;
}

const initialState = (): KffNotificationsState => ({
  items: [],
  loaded: false,
  loading: false,
  refreshing: false,
  error: null,
  page: 0,
  totalPages: 0,
});

let state = initialState();
const listeners = new Set<() => void>();
const setState = (patch: Partial<KffNotificationsState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getState = () => state;

export const useKffNotifications = () => useSyncExternalStore(subscribe, getState, getState);

export const isUnreadKffNotification = (item: any) => !item?.is_read;

let requestId = 0;

/** 'initial' / 'refresh' reload page 1; 'more' appends the next page. */
export const loadKffNotifications = async (mode: 'initial' | 'refresh' | 'more' = 'initial') => {
  if (mode === 'more' && (state.loading || state.page >= state.totalPages)) return;
  const id = ++requestId;
  const page = mode === 'more' ? state.page + 1 : 1;
  setState(mode === 'refresh' ? { refreshing: true } : { loading: true });

  const result = await fetchKffNotifications(page);
  if (id !== requestId) return; // superseded by a newer load
  if (!result.success) {
    setState({ loading: false, refreshing: false, loaded: true, error: result.error });
    return;
  }
  const { items, totalPages } = result.data;
  const merged =
    mode === 'more'
      ? [...state.items, ...items.filter((n) => !state.items.some((m) => m.id === n.id))]
      : items;
  setState({ items: merged, page, totalPages, loaded: true, loading: false, refreshing: false, error: null });
};

export const markKffNotificationAsRead = (id: string) => {
  const item = state.items.find((n) => n.id === id);
  if (!item || item.is_read) return;
  setState({ items: state.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)) });
  markKffNotificationRead(id).catch(() => {});
};

/** Clears the inbox (called on logout). */
export const resetKffNotifications = () => {
  requestId += 1;
  state = initialState();
  listeners.forEach((listener) => listener());
};
