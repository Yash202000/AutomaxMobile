import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { KFF_COLORS } from '../kffTheme';

interface KffCodeInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  /** Shows dots instead of digits (passcodes). Default true. */
  secure?: boolean;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}

// 4-digit passcode boxes for the KFF auth screens. One invisible TextInput
// over the boxes takes all input, so typing, deleting and pasting just work.
const KffCodeInput = ({
  value,
  onChange,
  length = 4,
  secure = true,
  autoFocus = false,
  onComplete,
}: KffCodeInputProps) => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    // Tapping anywhere on the boxes focuses the input (also re-opens the
    // keyboard after it was dismissed).
    <Pressable style={styles.wrapper} onPress={() => inputRef.current?.focus()}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length }).map((_, index) => {
          const digit = value[index];
          const isCursor = focused && index === Math.min(value.length, length - 1);
          return (
            <View key={index} style={[styles.box, isCursor && styles.boxActive]}>
              <Text style={styles.digit}>{digit ? (secure ? '●' : digit) : ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        caretHidden
        selectionColor="transparent"
        textContentType="oneTimeCode"
        contextMenuHidden
        maxLength={length}
        secureTextEntry={false}
        importantForAutofill="no"
        accessibilityLabel="Passcode"
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  box: {
    width: 48,
    height: 46,
    borderWidth: 1,
    borderColor: '#C4C7CF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KFF_COLORS.white,
  },
  boxActive: {
    borderColor: KFF_COLORS.primary,
    borderWidth: 2,
  },
  digit: {
    fontSize: 18,
    color: KFF_COLORS.text,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    // NOT opacity: 0 — iOS ignores touches (and focus) on views with alpha
    // below 0.01. Keep it fully opaque but with invisible text instead.
    color: 'transparent',
    backgroundColor: 'transparent',
  },
});

export default KffCodeInput;
