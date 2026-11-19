import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KFF_COLORS } from '../kffTheme';
import { KFF_AUTH_BLUE } from './kffAuthTheme';
import KffLanguagePicker from './KffLanguagePicker';

interface KffAuthLayoutProps {
  children: React.ReactNode;
  /** Back arrow, pinned at the top of the card. */
  onBack?: () => void;
  /**
   * When the keyboard opens, scroll the card to its end (code entry + main
   * button) instead of to the focused field — login / create-passcode.
   */
  scrollToEndOnKeyboard?: boolean;
}

// Lets inputs inside the card ask to be scrolled into view (used when focus
// moves between fields while the keyboard is already open).
const RevealFocusedContext = createContext<() => void>(() => {});
export const useKffRevealFocused = () => useContext(RevealFocusedContext);

const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION;

// Shared frame for the KFF login / register / create-passcode screens.
// The logo, language toggle and white card never move: when the keyboard
// opens only the card gets shorter and its content scrolls inside it.
const KffAuthLayout = ({ children, onBack, scrollToEndOnKeyboard }: KffAuthLayoutProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null); // same top edge as the card's scroll area
  const scrollY = useRef(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const revealFocused = useCallback(() => {
    setTimeout(() => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      if (scrollToEndOnKeyboard) {
        scroll.scrollToEnd({ animated: true });
        return;
      }
      const input = TextInput.State.currentlyFocusedInput();
      if (!input) return;
      // Both measured on screen; the difference is the input's position inside
      // the card's scroll area. Bring its label into view at the top.
      viewportRef.current?.measureInWindow((_vx, viewportTop) => {
        input.measureInWindow((_ix, inputTop) => {
          const target = scrollY.current + (inputTop - viewportTop) - 36;
          scroll.scrollTo({ y: Math.max(0, target), animated: true });
        });
      });
    }, 150); // after the card has shrunk for the keyboard
  }, [scrollToEndOnKeyboard]);

  useEffect(() => {
    const isIos = Platform.OS === 'ios';
    const show = Keyboard.addListener(isIos ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKeyboardOpen(true);
      revealFocused();
    });
    const hide = Keyboard.addListener(isIos ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [revealFocused]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* Soft diagonal bands, as in the design */}
      <View style={[styles.band, styles.bandLight]} pointerEvents="none" />
      <View style={[styles.band, styles.bandDark]} pointerEvents="none" />

      {/* Fixed header: logo + language */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Image
          source={require('@/assets/images/kff/kff-splash-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Automax"
        />
        <KffLanguagePicker />
      </View>

      {/* Edge-to-edge Android no longer resizes for the keyboard, so pad on
          both platforms. Only this area (the card) reacts to the keyboard. */}
      <KeyboardAvoidingView
        style={[styles.body, { paddingBottom: keyboardOpen ? 12 : insets.bottom + 16 }]}
        behavior="padding"
      >
        <View style={styles.card}>
          {onBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              hitSlop={10}
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name={t('common.icons.arrowBack') as any} size={24} color={KFF_COLORS.text} />
            </TouchableOpacity>
          )}
          <View ref={viewportRef} style={styles.viewport}>
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={[styles.cardContent, !onBack && styles.cardContentTop]}
              onScroll={(e) => {
                scrollY.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={32}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <RevealFocusedContext.Provider value={revealFocused}>{children}</RevealFocusedContext.Provider>
            </ScrollView>
          </View>
        </View>

        {!!APP_VERSION && !keyboardOpen && (
          <Text style={styles.version}>
            {t('settings.version')} {APP_VERSION}
          </Text>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: KFF_AUTH_BLUE,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    width: 220,
    height: '160%',
    top: '-30%',
    transform: [{ rotate: '18deg' }],
  },
  bandLight: {
    right: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bandDark: {
    left: -170,
    backgroundColor: 'rgba(20,40,160,0.18)',
  },
  header: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  logo: {
    width: '56%',
    height: 48,
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
  },
  // Sized to its content, but shrinks (and scrolls inside) when space runs out.
  card: {
    flexShrink: 1,
    backgroundColor: KFF_COLORS.white,
    borderRadius: 22,
    shadowColor: '#0B1A6B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    marginHorizontal: 16,
    marginBottom: 2,
  },
  viewport: {
    flexShrink: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  cardContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 22,
  },
  cardContentTop: {
    paddingTop: 18,
  },
  version: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 14,
  },
});

export default KffAuthLayout;
