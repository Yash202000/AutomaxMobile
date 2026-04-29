import i18n from '@/src/i18n';
import { crashLogger } from '@/src/utils/crashLogger';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Log to crash logger
    crashLogger.logCrash(error, true, errorInfo.componentStack || "").catch((logError) => {
      console.error('[ErrorBoundary] Failed to log crash:', logError);
    });
  }

  handleReload = async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      // If reload fails, reset state to try to recover
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }
  };

  render() {
    if (this.state.hasError) {
      // Basic check: if the error matches our logout cancellation, just show loading
      const isLogoutError = this.state.error?.message?.includes('logging out') ||
        (this.state.error as any)?.isLogoutCancel;

      if (isLogoutError) {
        return (
          <View style={styles.container}>
            <ActivityIndicator size="large" color="#2EC4B6" />
          </View>
        );
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle" size={64} color="#E74C3C" />
            </View>

            <Text style={styles.title}>{i18n.t('errors.oopsTitle')}</Text>
            <Text style={styles.subtitle}>
              {i18n.t('errors.unexpectedError')}
            </Text>

            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetailsContainer}>
                <Text style={styles.errorTitle}>{i18n.t('errors.devModeDetails')}</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                {this.state.error.stack && (
                  <>
                    <Text style={styles.errorTitle}>{i18n.t('errors.stackTrace')}</Text>
                    <Text style={styles.errorText}>{this.state.error.stack}</Text>
                  </>
                )}
                {this.state.errorInfo && this.state.errorInfo.componentStack && (
                  <>
                    <Text style={styles.errorTitle}>{i18n.t('errors.componentStack')}</Text>
                    <Text style={styles.errorText}>{this.state.errorInfo.componentStack}</Text>
                  </>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.reloadButton} onPress={this.handleReload}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.reloadButtonText}>{i18n.t('errors.reloadApp')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorDetailsContainer: {
    maxHeight: 300,
    width: '100%',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E74C3C',
    marginTop: 12,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2EC4B6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  reloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
