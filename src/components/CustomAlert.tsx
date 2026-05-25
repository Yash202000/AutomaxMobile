import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, InteractionManager, Modal, Alert as NativeAlert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

let setAlertStateGlobal: ((state: AlertState) => void) | null = null;

export const CustomAlertComponent = () => {
  const { t } = useTranslation();
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
  });

  useEffect(() => {
    setAlertStateGlobal = setAlertState;
    return () => {
      setAlertStateGlobal = null;
    };
  }, []);

  if (!alertState.visible) return null;

  const defaultButtons: AlertButton[] = [{ text: 'OK', onPress: () => { } }];
  const buttonsToRender = alertState.buttons && alertState.buttons.length > 0 ? alertState.buttons : defaultButtons;
  return (
    <Modal transparent animationType="fade" visible={alertState.visible} onRequestClose={() => { }}>
      <View style={styles.overlay}>
        <View style={[styles.alertBox]}>
          <View style={{ alignItems: 'flex-start', width: '100%', flexDirection: 'column' }}>
            <Text style={[styles.title]}>{alertState.title}</Text>
            {!!alertState.message && <Text style={[styles.message]}>{alertState.message}</Text>}
          </View>
          <View style={[styles.buttonContainer, { flexDirection: 'row', justifyContent: 'flex-end' }]}>
            {buttonsToRender.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.button, isCancel && styles.cancelButton, isDestructive && styles.destructiveButton]}
                  onPress={() => {
                    setAlertState(prev => ({ ...prev, visible: false }));
                    if (btn.onPress) {
                      // Defer the callback until after the Modal dismiss animation
                      // fully completes on iOS — prevents UI freeze / deadlock.
                      InteractionManager.runAfterInteractions(() => {
                        btn.onPress!();
                      });
                    }
                  }}
                >
                  <Text style={[styles.buttonText, isCancel && styles.cancelButtonText, isDestructive && styles.destructiveButtonText]}>
                    {btn.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const CustomAlert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    if (setAlertStateGlobal) {
      setAlertStateGlobal({
        visible: true,
        title,
        message,
        buttons,
      });
    } else {
      // Fallback to native alert if component isn't mounted yet
      NativeAlert.alert(title, message, buttons as any);
    }
  },
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    flexDirection: 'column',
    backgroundColor: 'white',
    width: Dimensions.get('window').width * 0.85,
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  message: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  buttonContainer: {
    gap: 10,
    marginTop: 10,
    width: '100%',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2EC4B6',
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#CCC',
  },
  destructiveButton: {
    backgroundColor: '#E74C3C',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666',
  },
  destructiveButtonText: {
    color: 'white',
  },
});
