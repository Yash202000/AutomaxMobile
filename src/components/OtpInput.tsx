import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

interface OtpInputProps {
  value: string[];
  onChange: (otp: string[]) => void;
  length?: number;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}

// A single real TextInput backs the whole row (invisible, absolutely
// positioned over the boxes) so the OS can autofill it from an incoming SMS:
// `textContentType="oneTimeCode"` drives iOS's QuickType suggestion bar,
// `autoComplete="one-time-code"` drives the equivalent on Android. The boxes
// below are purely visual (`pointerEvents="none"`) — the real input sits on
// top and receives every tap/keystroke/autofill.
export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, length = 6, autoFocus = true, onComplete }) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const joined = value.join('');

  const handleChangeText = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(Array.from({ length }, (_, i) => digits[i] || ''));
    if (digits.length === length) {
      onComplete?.(digits);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.otpContainer} pointerEvents="none">
        {Array.from({ length }).map((_, index) => {
          const digit = value[index] || '';
          const isCursor = isFocused && index === joined.length;
          return (
            <View key={index} style={[styles.otpBox, isCursor && styles.otpBoxActive]}>
              <Text style={styles.otpDigit}>{digit}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={joined}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        importantForAutofill="yes"
        caretHidden
      />
    </View>
  );
};

// Shared 60s resend-cooldown countdown, identical logic previously duplicated
// in app/otp.tsx and app/edit-profile.tsx's OTP modal.
export function useOtpResendTimer(initialSeconds = 60) {
  const [timer, setTimer] = useState(initialSeconds);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const reset = () => setTimer(initialSeconds);

  return { timer, reset };
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: 30,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otpBox: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxActive: {
    borderColor: '#2EC4B6',
    borderWidth: 2,
  },
  otpDigit: {
    fontSize: 20,
    textAlign: 'center',
    color: '#000',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
