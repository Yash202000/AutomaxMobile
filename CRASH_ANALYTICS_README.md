# Crash Analytics & Logging System

This mobile app includes a comprehensive crash analytics and logging system that automatically captures errors, crashes, and warnings to help with debugging and issue resolution.

## Features

✅ **Automatic Error Logging**: All JavaScript errors are automatically captured and logged
✅ **React Error Boundary**: Catches and logs React component crashes
✅ **Global Error Handlers**: Console errors and warnings are logged
✅ **File-Based Storage**: Logs are stored locally in the app's document directory
✅ **Log Rotation**: Automatic log file rotation when size exceeds 5MB
✅ **Share Logs**: Easy sharing of log files via the Settings page
✅ **Delete Logs**: Clear old logs to free up space

## Installation

First, install the required dependencies:

```bash
cd AutomaxMobile
npm install
```

The following packages have been added to `package.json`:
- `expo-file-system` - For reading/writing log files
- `expo-sharing` - For sharing log files with other apps

## How It Works

### 1. **Crash Logger Service** (`src/utils/crashLogger.ts`)

The crash logger service handles all logging operations:

- **logError()**: Log general errors
- **logCrash()**: Log fatal crashes with component stack
- **logWarning()**: Log warnings
- **logInfo()**: Log informational messages
- **getLogs()**: Retrieve all logs as text
- **clearLogs()**: Delete all logs
- **getLogFileSize()**: Get current log file size
- **hasLogs()**: Check if logs exist

### 2. **Error Boundary** (`src/components/ErrorBoundary.tsx`)

Wraps the entire app to catch React component errors and display a user-friendly error screen with reload option.

### 3. **Global Error Handlers** (`app/_layout.tsx`)

Automatically initialized on app startup to capture:
- `console.error()` calls
- `console.warn()` calls
- Uncaught exceptions

### 4. **Settings Integration** (`app/(tabs)/setting.tsx`)

The Settings page shows:
- Current log file size
- Log status (Available/Empty)
- **Share Logs** button - Share logs via email, messages, etc.
- **Delete Logs** button - Clear all logs with confirmation

## Usage

### Viewing & Managing Logs

1. Open the app and navigate to **Settings** tab
2. Scroll to the **Diagnostics** section
3. You'll see:
   - Log File Size (e.g., "125.45 KB")
   - Status (Available or Empty)
4. **Share Logs**: Tap to share log file via any app (Email, WhatsApp, etc.)
5. **Delete Logs**: Tap to delete all logs (requires confirmation)

### Testing the Crash Logger

A test utility file is provided at `src/utils/testCrashLogger.ts`. You can import and use it anywhere in your app:

```typescript
import { runAllTests, testBasicError, testCrashWithStack } from '@/src/utils/testCrashLogger';

// Test all logging functions
await runAllTests();

// Or test individual functions
await testBasicError();
await testCrashWithStack();
```

To add a test button to any screen:

```typescript
import { testBasicError } from '@/src/utils/testCrashLogger';

<TouchableOpacity onPress={testBasicError}>
  <Text>Generate Test Crash</Text>
</TouchableOpacity>
```

### Manual Logging in Your Code

You can manually log errors anywhere in your app:

```typescript
import { crashLogger } from '@/src/utils/crashLogger';

// Log an error
try {
  // Your code
  const result = riskyOperation();
} catch (error) {
  await crashLogger.logError(error as Error, {
    context: 'User Profile Screen',
    action: 'Update Profile',
    userId: user.id,
  });
}

// Log a warning
await crashLogger.logWarning('Deprecated API used', {
  endpoint: '/api/v1/users',
  suggestion: 'Use /api/v2/users instead',
});

// Log info for debugging
await crashLogger.logInfo('User logged in', {
  userId: user.id,
  loginMethod: 'email',
});
```

## Log Format

Logs are formatted as follows:

```
================================================================================
[ERROR] 2026-02-02T10:30:45.123Z
Message: Cannot read property 'id' of undefined

Stack Trace:
TypeError: Cannot read property 'id' of undefined
    at handleSubmit (add-incident.tsx:633)
    at onPress (Button.tsx:45)
    ...

Metadata:
{
  "context": "Create Incident Screen",
  "userId": "12345",
  "action": "submit_form"
}
================================================================================
```

## Log File Location

- **iOS**: `file:///var/mobile/Containers/Data/Application/{UUID}/Documents/app_crash_logs.txt`
- **Android**: `file:///data/user/0/{package.name}/files/app_crash_logs.txt`

## Log Rotation

When the log file exceeds **5MB**:
1. Current log is backed up to `app_crash_logs_backup.txt`
2. A fresh log file is created
3. Logging continues to the new file

## Best Practices

1. **Don't log sensitive data**: Avoid logging passwords, tokens, or personal information
2. **Use appropriate log levels**:
   - `logError()`: For errors that need attention
   - `logWarning()`: For potential issues
   - `logInfo()`: For general debugging info
3. **Add context**: Always include relevant metadata with logs
4. **Regular cleanup**: Encourage users to share and delete old logs periodically

## Troubleshooting

### Logs not being created

1. Check if crash logger is initialized in `app/_layout.tsx`
2. Verify file permissions (should work automatically with Expo)
3. Check console for initialization errors

### Share button not working

1. Ensure `expo-sharing` is installed: `npx expo install expo-sharing`
2. Check if device supports sharing (some emulators may not)
3. Verify log file exists before sharing

### Log file too large

The system automatically rotates logs at 5MB. If you need to:
- Increase limit: Edit `MAX_LOG_SIZE` in `crashLogger.ts`
- Force rotation: Delete logs from Settings

## Integration with Backend (Future Enhancement)

To send logs to a backend server:

```typescript
// Add to crashLogger.ts
async uploadLogs(endpoint: string) {
  const logs = await this.getLogs();

  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      logs,
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version,
      },
      timestamp: new Date().toISOString(),
    }),
  });
}
```

## Support

For issues or questions, please check:
- Console logs during app initialization
- Settings > Diagnostics section for log status
- Test the logging system with `testCrashLogger.ts`

---

**Version**: 1.0.0
**Last Updated**: 2026-02-02
