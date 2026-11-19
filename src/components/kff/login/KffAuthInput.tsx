import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';

import { KFF_COLORS } from '../kffTheme';
import { useKffRevealFocused } from './KffAuthLayout';
import { KFF_AUTH_BLUE } from './kffAuthTheme';

interface KffAuthInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Password field: masked, with a show/hide toggle. */
  secure?: boolean;
}

// Labelled text field for the KFF auth screens: leading icon, blue focus ring.
const KffAuthInput = forwardRef<TextInput, KffAuthInputProps>(
  ({ label, icon, secure, onFocus, onBlur, ...inputProps }, ref) => {
    const { t } = useTranslation();
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);
    const revealFocused = useKffRevealFocused();

    return (
      <View style={styles.wrapper}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.field, focused && styles.fieldFocused]}>
          <Ionicons
            name={icon}
            size={20}
            color={focused ? KFF_AUTH_BLUE : KFF_COLORS.textMuted}
          />
          <TextInput
            ref={ref}
            style={styles.input}
            placeholderTextColor={KFF_COLORS.textMuted}
            secureTextEntry={secure && hidden}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={(e) => {
              setFocused(true);
              // Keyboard already open (e.g. "Next" from the previous field).
              if (Keyboard.isVisible()) revealFocused();
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...inputProps}
          />
          {secure && (
            <TouchableOpacity
              onPress={() => setHidden((value) => !value)}
              hitSlop={10}
              accessibilityLabel={t('kff.register.togglePassword')}
            >
              <Ionicons
                name={hidden ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={KFF_COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  },
);

KffAuthInput.displayName = 'KffAuthInput';

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: KFF_COLORS.navy,
    textAlign: 'left',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E3E6EE',
    backgroundColor: '#F7F8FB',
  },
  // Colour-only change on purpose: adding elevation/shadow here on focus made
  // Android drop the input's focus right away (keyboard closed instantly).
  fieldFocused: {
    borderColor: KFF_AUTH_BLUE,
    backgroundColor: KFF_COLORS.white,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: KFF_COLORS.text,
    textAlign: 'left',
  },
});

export default KffAuthInput;
