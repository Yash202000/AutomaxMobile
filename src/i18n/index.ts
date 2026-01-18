import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import en from './locales/en.json';
import ar from './locales/ar.json';

const LANGUAGE_KEY = '@app_language';

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
};

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
];

// Get stored language or device language
const getStoredLanguage = async (): Promise<string> => {
  try {
    const storedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (storedLang && (storedLang === 'en' || storedLang === 'ar')) {
      return storedLang;
    }
    // Fall back to device language
    const deviceLang = Localization.getLocales()[0]?.languageCode;
    return deviceLang === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
};

// Save language preference
export const setLanguage = async (lang: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    const isRTL = lang === 'ar';

    // Update RTL
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
    }

    await i18n.changeLanguage(lang);
  } catch (error) {
    console.error('Error setting language:', error);
  }
};

// Get current language
export const getCurrentLanguage = (): string => {
  return i18n.language || 'en';
};

// Check if current language is RTL
export const isRTL = (): boolean => {
  return getCurrentLanguage() === 'ar';
};

// Initialize i18n
const initI18n = async () => {
  const lang = await getStoredLanguage();
  const isRTLLang = lang === 'ar';

  // Set RTL on app start
  I18nManager.allowRTL(isRTLLang);
  I18nManager.forceRTL(isRTLLang);

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: lang,
      fallbackLng: 'en',
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
};

// Initialize on import
initI18n();

export default i18n;
