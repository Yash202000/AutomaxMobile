import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getKffLocale, isSameDay, startOfDay } from './kffDateUtils';
import { KFF_COLORS } from './kffTheme';

const WEEKS = 6;
/** Any Sunday — the grid starts weeks on Sunday. */
const A_SUNDAY = new Date(2023, 0, 1);

interface KffMonthCalendarProps {
  visible: boolean;
  value: Date;
  /** Last date that can be picked (later days are disabled). */
  maximumDate?: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

// KFF month calendar (opened from the date strip's month title): big selected
// day + "Month, Year" with month arrows, a weekday header pill and a 6-week
// grid where the neighbouring months' days are greyed. Names and digits follow
// the app language; the grid flips with the app's RTL layout in Arabic.
const KffMonthCalendar = ({ visible, value, maximumDate, onSelect, onClose }: KffMonthCalendarProps) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const locale = getKffLocale(i18n.language);

  const [picked, setPicked] = useState(() => startOfDay(value));
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  // Start from the strip's date each time the calendar opens.
  useEffect(() => {
    if (!visible) return;
    setPicked(startOfDay(value));
    setMonth(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [visible, value]);

  const max = maximumDate ? startOfDay(maximumDate).getTime() : Infinity;
  const today = new Date();

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(A_SUNDAY.getFullYear(), 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }),
      ),
    [locale],
  );

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    return Array.from(
      { length: WEEKS * 7 },
      (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i),
    );
  }, [month]);

  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const canGoNext = nextMonth.getTime() <= max;
  const shiftMonth = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  const monthName = month.toLocaleDateString(locale, { month: 'long' });
  const yearName = month.toLocaleDateString(locale, { year: 'numeric' });
  const pickedDay = picked.toLocaleDateString(locale, { day: '2-digit' });

  const pick = (date: Date) => {
    setPicked(date);
    if (date.getMonth() !== month.getMonth()) {
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card}>
          {/* Header: big day + month / year with arrows, calendar tile */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.bigDay}>{pickedDay}</Text>
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navButton}>
                  <Ionicons name={t('common.icons.chevronBack') as any} size={18} color={KFF_COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.monthTitle} numberOfLines={1}>
                  {monthName}
                  {isAr ? '، ' : ', '}
                  {yearName}
                </Text>
                <TouchableOpacity
                  onPress={() => shiftMonth(1)}
                  hitSlop={10}
                  disabled={!canGoNext}
                  style={[styles.navButton, !canGoNext && styles.navDisabled]}
                >
                  <Ionicons name={t('common.icons.chevronForward') as any} size={18} color={KFF_COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.calendarTile}>
              <View style={styles.calendarTileTop} />
              <Ionicons name="time" size={24} color={KFF_COLORS.primaryRing} />
            </View>
          </View>

          {/* Weekday header */}
          <View style={styles.weekdays}>
            {weekdays.map((name) => (
              <Text key={name} style={styles.weekday} numberOfLines={1} adjustsFontSizeToFit>
                {name}
              </Text>
            ))}
          </View>

          {/* 6-week grid */}
          <View style={styles.grid}>
            {Array.from({ length: WEEKS }, (_, week) => (
              <View key={week} style={styles.week}>
                {cells.slice(week * 7, week * 7 + 7).map((date) => {
                  const inMonth = date.getMonth() === month.getMonth();
                  const disabled = date.getTime() > max;
                  const selected = isSameDay(date, picked);
                  const isToday = isSameDay(date, today);
                  return (
                    <TouchableOpacity
                      key={date.toISOString()}
                      style={styles.dayCell}
                      disabled={disabled}
                      activeOpacity={0.7}
                      onPress={() => pick(date)}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          isToday && !selected && styles.todayCircle,
                          selected && styles.selectedCircle,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            !inMonth && styles.dayTextOutside,
                            disabled && styles.dayTextDisabled,
                            selected && styles.dayTextSelected,
                          ]}
                        >
                          {date.toLocaleDateString(locale, { day: '2-digit' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => onSelect(picked)}
              activeOpacity={0.85}
            >
              <Text style={styles.doneText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    backgroundColor: KFF_COLORS.white,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 16,
    shadowColor: KFF_COLORS.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
    alignItems: 'flex-start',
  },
  bigDay: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: '800',
    color: KFF_COLORS.primary,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: KFF_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisabled: {
    opacity: 0.35,
  },
  monthTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '600',
    color: KFF_COLORS.navy,
  },
  calendarTile: {
    width: 74,
    height: 70,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: KFF_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    overflow: 'hidden',
  },
  calendarTileTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: KFF_COLORS.primary,
  },
  weekdays: {
    flexDirection: 'row',
    backgroundColor: KFF_COLORS.primarySoft,
    borderRadius: 16,
    paddingVertical: 9,
    marginBottom: 6,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: KFF_COLORS.primary,
    paddingHorizontal: 1,
  },
  grid: {
    gap: 2,
  },
  week: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 3,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    borderWidth: 1.5,
    borderColor: KFF_COLORS.primary,
  },
  selectedCircle: {
    backgroundColor: KFF_COLORS.primary,
    shadowColor: KFF_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: KFF_COLORS.text,
  },
  dayTextOutside: {
    color: KFF_COLORS.textMuted,
  },
  dayTextDisabled: {
    color: '#D9DCE5',
  },
  dayTextSelected: {
    color: KFF_COLORS.white,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: KFF_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: KFF_COLORS.primary,
  },
  doneButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: KFF_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    color: KFF_COLORS.white,
  },
});

export default KffMonthCalendar;
