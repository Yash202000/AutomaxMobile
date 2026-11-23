import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { addDays, getKffLocale, isSameDay, startOfDay } from './kffDateUtils';
import KffMonthCalendar from './KffMonthCalendar';
import { KFF_COLORS } from './kffTheme';

const ITEM_WIDTH = 54;

interface KffCalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** How many future days (after today) can be picked. */
  daysForward?: number;
  /** Draws the thin divider lines above and below the strip. */
  showDividers?: boolean;
}

// Common KFF date strip — shared by the Profile and My Incidents screens.
// Shows the selected date's month: the 1st to today for the current month,
// the whole month (1st – 30th/31st) for earlier ones. Tapping the
// "November 2026" title opens a month calendar to jump to another month.
const KffCalendarStrip = ({
  selectedDate,
  onSelectDate,
  daysForward = 0,
  showDividers = true,
}: KffCalendarStripProps) => {
  const { i18n } = useTranslation();
  const locale = getKffLocale(i18n.language);
  const listRef = useRef<FlatList<Date>>(null);
  const [listWidth, setListWidth] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const year = selectedDate.getFullYear();
  const monthIndex = selectedDate.getMonth();
  const maximumDate = addDays(startOfDay(new Date()), daysForward);
  const lastAllowed = maximumDate.getTime();

  const days = useMemo(() => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, monthIndex, i + 1)).filter(
      (d) => d.getTime() <= lastAllowed,
    );
  }, [year, monthIndex, lastAllowed]);

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
  }, [selectedIndex, listWidth, days.length]);

  const openMonthCalendar = () => setPickerOpen(true);

  const getItemLayout = useCallback(
    (_: ArrayLike<Date> | null | undefined, index: number) => ({
      length: ITEM_WIDTH,
      offset: ITEM_WIDTH * index,
      index,
    }),
    [],
  );

  const today = new Date();
  const monthLabel = selectedDate.toLocaleDateString(locale, { month: 'long' });
  const yearLabel = selectedDate.toLocaleDateString(locale, { year: 'numeric' });

  return (
    <View>
      <TouchableOpacity style={styles.monthButton} activeOpacity={0.6} onPress={openMonthCalendar}>
        <Text style={styles.monthRow}>
          <Text style={styles.month}>{monthLabel} </Text>
          <Text style={styles.year}>{yearLabel}</Text>
        </Text>
      </TouchableOpacity>
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

      <KffMonthCalendar
        visible={pickerOpen}
        value={selectedDate}
        maximumDate={maximumDate}
        onClose={() => setPickerOpen(false)}
        onSelect={(date) => {
          setPickerOpen(false);
          onSelectDate(startOfDay(date));
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  monthRow: {
    textAlign: 'center',
    fontSize: 16,
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
