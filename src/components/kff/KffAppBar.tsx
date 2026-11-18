import { CustomAlert } from '@/src/components/CustomAlert';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resetKffIncidents, useKffIncidents } from './kffIncidentStore';
import { KFF_COLORS } from './kffTheme';

interface KffAppBarProps {
  title?: string;
  subtitle?: string;
  /** Shows a back button when provided. */
  onBack?: () => void;
  /** Bell + logout icons on the right. Default true. */
  showActions?: boolean;
  /** Centres the title instead of left-aligning it. */
  centerTitle?: boolean;
}

// Sticky KFF app bar: sits outside each screen's scroll view and pads itself
// for the top safe area. Bell badge = live count of incoming incidents.
const KffAppBar = ({ title, subtitle, onBack, showActions = true, centerTitle = false }: KffAppBarProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { incoming } = useKffIncidents();
  const count = incoming.length;

  // Small "pop" on the badge whenever the count changes.
  const badgeScale = useRef(new Animated.Value(1)).current;
  const previousCount = useRef(count);
  useEffect(() => {
    if (previousCount.current === count) return;
    previousCount.current = count;
    badgeScale.setValue(1.4);
    Animated.spring(badgeScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [count, badgeScale]);

  const handleLogout = () => {
    CustomAlert.alert(t('auth.logout'), t('kff.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
        style: 'destructive',
        onPress: () => {
          resetKffIncidents();
          logout();
        },
      },
    ]);
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={8}>
          <Ionicons name={t('common.icons.arrowBack') as any} size={22} color={KFF_COLORS.navy} />
        </TouchableOpacity>
      )}

      <View style={styles.titleBlock}>
        {!!subtitle && (
          <Text style={[styles.subtitle, centerTitle && styles.centered]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {!!title && (
          <Text style={[styles.title, centerTitle && styles.centered]} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>

      {/* Balances the back button so a centred title stays truly centred. */}
      {centerTitle && !showActions && onBack && <View style={styles.backButtonSpacer} />}

      {showActions && (
        <>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.navigate('/(tabs)/kff-incident-alerts')}
            accessibilityLabel={t('kff.alerts.title')}
            hitSlop={6}
          >
            <Ionicons name="notifications" size={26} color={KFF_COLORS.primary} />
            {count > 0 && (
              <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
                <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
              </Animated.View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleLogout}
            accessibilityLabel={t('auth.logout')}
            hitSlop={6}
          >
            <Image
              source={require('@/assets/images/kff/logout.svg')}
              style={styles.logoutIcon}
              contentFit="contain"
            />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    // Semi-transparent so the KFF map background stays visible behind the bar.
    // No elevation/shadow: on a translucent view it bleeds through as a grey smudge.
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(30,43,94,0.12)',
    zIndex: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: KFF_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonSpacer: {
    width: 38,
  },
  centered: {
    textAlign: 'center',
  },
  titleBlock: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  subtitle: {
    fontSize: 12,
    color: KFF_COLORS.textSecondary,
    textAlign: 'left',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: KFF_COLORS.navy,
    textAlign: 'left',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    width: 26,
    height: 20,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: KFF_COLORS.accepted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: KFF_COLORS.white,
  },
  badgeText: {
    color: KFF_COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
});

export default KffAppBar;
