import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { addDays, getKffLocale, isSameDay, startOfDay } from './kffDateUtils';
import { KFF_COLORS } from './kffTheme';

const ITEM_WIDTH = 54;

interface KffCalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** How many past days to show before today. */
  daysBack?: number;
  /** How many future days to show after today. */
  daysForward?: number;
  /** Draws the thin divider lines above and below the strip. */
  showDividers?: boolean;
}

// Common KFF date strip — shared by the Profile and My Incidents screens.
const KffCalendarStrip = ({
  selectedDate,
  onSelectDate,
  daysBack = 30,
  daysForward = 0,
  showDividers = true,
}: KffCalendarStripProps) => {
  const { i18n } = useTranslation();
  const locale = getKffLocale(i18n.language);
  const listRef = useRef<FlatList<Date>>(null);
  const [listWidth, setListWidth] = useState(0);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: daysBack + daysForward + 1 }, (_, i) =>
      addDays(today, i - daysBack),
    );
  }, [daysBack, daysForward]);

  const selectedIndex = Math.max(
    0,
    days.findIndex((d) => isSameDay(d, selectedDate)),
  );

  // Keep the selected day centred whenever it (or the strip width) changes.
  useEffect(() => {
    if (!listWidth || !listRef.current) return;
    listRef.current.scrollToIndex({
      index: selectedIndex,
      viewPosition: 0.5,
      animated: true,
    });
  }, [selectedIndex, listWidth]);

  const getItemLayout = useCallback(
    (_: ArrayLike<Date> | null | undefined, index: number) => ({
      length: ITEM_WIDTH,
      offset: ITEM_WIDTH * index,
      index,
    }),
    [],
  );

  const today = new Date();
  const month = selectedDate.toLocaleDateString(locale, { month: 'long' });
  const year = selectedDate.toLocaleDateString(locale, { year: 'numeric' });

  return (
    <View>
      <Text style={styles.monthRow}>
        <Text style={styles.month}>{month} </Text>
        <Text style={styles.year}>{year}</Text>
      </Text>
      <View style={[styles.stripWrapper, showDividers && styles.dividers]}>
        <FlatList
          ref={listRef}
          data={days}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(d) => d.toISOString()}
          getItemLayout={getItemLayout}
          initialScrollIndex={selectedIndex}
          onLayout={(e) => setListWidth(e.nativeEvent.layout.width)}
          onScrollToIndexFailed={() => {}}
          contentContainerStyle={styles.stripContent}
          style={styles.strip}
          renderItem={({ item }) => {
            const selected = isSameDay(item, selectedDate);
            const isToday = isSameDay(item, today);
            return (
              <TouchableOpacity
                style={styles.dayItem}
                activeOpacity={0.7}
                onPress={() => onSelectDate(item)}
              >
                <View style={[styles.dayInner, selected && styles.daySelected]}>
                  <Text style={[styles.weekday, selected && styles.textSelected]}>
                    {item.toLocaleDateString(locale, { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNumber, selected && styles.textSelected]}>
                    {item.toLocaleDateString(locale, { day: 'numeric' })}
                  </Text>
                  {isToday && !selected && <View style={styles.todayDot} />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  monthRow: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 6,
  },
  month: {
    color: KFF_COLORS.primary,
    fontWeight: '700',
  },
  year: {
    color: KFF_COLORS.primary,
    fontWeight: '400',
  },
  stripWrapper: {
    paddingVertical: 6,
  },
  dividers: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: KFF_COLORS.divider,
  },
  strip: {
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  stripContent: {
    paddingHorizontal: 4,
  },
  dayItem: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  dayInner: {
    width: ITEM_WIDTH - 8,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  daySelected: {
    backgroundColor: KFF_COLORS.primary,
    shadowColor: KFF_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  weekday: {
    fontSize: 12,
    color: KFF_COLORS.navy,
  },
  dayNumber: {
    fontSize: 14,
    color: KFF_COLORS.navy,
    marginTop: 2,
  },
  textSelected: {
    color: KFF_COLORS.white,
    fontWeight: '700',
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: KFF_COLORS.primary,
    marginTop: 2,
  },
});

export default KffCalendarStrip;
