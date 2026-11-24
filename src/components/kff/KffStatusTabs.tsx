import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { KFF_COLORS } from './kffTheme';
import type { KffListStatus } from './kffTypes';

const VISIBLE_TABS = 3;
const GAP = 6;
const ARROW_WIDTH = 26;

interface KffStatusTabsProps {
  statuses: KffListStatus[];
  active: KffListStatus;
  counts: Record<KffListStatus, number>;
  onChange: (status: KffListStatus) => void;
}

// My Incidents status tabs: three fit the bar (Accepted / Completed /
// Rejected up front); the rest are a swipe away. Swipes snap a page of three
// at a time; the arrow at the end hints at more and pages forward (back to
// the start once at the end).
const KffStatusTabs = ({ statuses, active, counts, onChange }: KffStatusTabsProps) => {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const offset = useRef(0);

  const scrollable = statuses.length > VISIBLE_TABS;
  const tabWidth = width ? (width - GAP * (VISIBLE_TABS - 1)) / VISIBLE_TABS : 0;
  const step = tabWidth + GAP; // one tab
  const page = width + GAP; // three tabs

  const scrollTo = (x: number) => scrollRef.current?.scrollTo({ x: Math.max(0, x), animated: true });

  // Keep the active tab in view (e.g. Profile → Reached).
  const activeIndex = statuses.indexOf(active);
  useEffect(() => {
    if (!scrollable || !tabWidth || activeIndex < 0) return;
    const first = Math.round(offset.current / step);
    let x: number | undefined;
    if (activeIndex < first) x = activeIndex * step;
    else if (activeIndex > first + VISIBLE_TABS - 1) x = (activeIndex - VISIBLE_TABS + 1) * step;
    if (x !== undefined) scrollRef.current?.scrollTo({ x, animated: true });
  }, [activeIndex, scrollable, tabWidth, step]);

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    offset.current = contentOffset.x;
    setAtEnd(contentOffset.x + layoutMeasurement.width >= contentSize.width - 4);
  };

  const onArrow = () => (atEnd ? scrollTo(0) : scrollTo(offset.current + page));

  return (
    <View style={styles.bar}>
      <ScrollView
        ref={scrollRef}
        horizontal
        style={styles.scroll}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={scrollable}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onScroll={onScroll}
        scrollEventThrottle={32}
        snapToInterval={scrollable && step ? step : undefined}
        decelerationRate="fast"
        contentContainerStyle={styles.content}
      >
        {statuses.map((status) => {
          const selected = status === active;
          return (
            <TouchableOpacity
              key={status}
              style={[styles.segment, { width: tabWidth || undefined }, selected && styles.segmentActive]}
              activeOpacity={0.8}
              onPress={() => onChange(status)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]} numberOfLines={1}>
                {t(`kff.status.${status}`)}
              </Text>
              <View style={[styles.segmentCount, selected && styles.segmentCountActive]}>
                <Text style={[styles.segmentCountText, selected && styles.segmentCountTextActive]}>
                  {counts[status]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {scrollable && (
        <TouchableOpacity style={styles.arrow} onPress={onArrow} hitSlop={8} activeOpacity={0.7}>
          <Ionicons
            name={t(atEnd ? 'common.icons.chevronBack' : 'common.icons.chevronForward') as any}
            size={18}
            color={KFF_COLORS.white}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KFF_COLORS.primary,
    borderRadius: 20,
    padding: 6,
    shadowColor: KFF_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: GAP,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 15,
  },
  segmentActive: {
    backgroundColor: KFF_COLORS.white,
  },
  segmentText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  segmentTextActive: {
    color: KFF_COLORS.primary,
  },
  segmentCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCountActive: {
    backgroundColor: KFF_COLORS.primarySoft,
  },
  segmentCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: KFF_COLORS.white,
  },
  segmentCountTextActive: {
    color: KFF_COLORS.primary,
  },
  arrow: {
    width: ARROW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
});

export default KffStatusTabs;
