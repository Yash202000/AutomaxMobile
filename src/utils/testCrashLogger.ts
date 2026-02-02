/**
 * Test Crash Logger
 *
 * This file contains utility functions to test the crash logging functionality.
 * Use these functions during development to ensure crash logs are being created properly.
 */

import { crashLogger } from './crashLogger';

/**
 * Simulates a basic error
 */
export const testBasicError = async () => {
  try {
    throw new Error('This is a test error');
  } catch (error) {
    await crashLogger.logError(error as Error, {
      context: 'Test Basic Error',
      timestamp: new Date().toISOString(),
    });
    console.log('Test basic error logged successfully');
  }
};

/**
 * Simulates a crash with component stack
 */
export const testCrashWithStack = async () => {
  try {
    const fakeError = new Error('Test crash with stack trace');
    fakeError.stack = `Error: Test crash with stack trace
    at testCrashWithStack (testCrashLogger.ts:25:23)
    at onPress (TestButton.tsx:10:5)
    at handlePress (Button.tsx:45:12)`;

    await crashLogger.logCrash(fakeError, false, `
    in TestButton (at TestScreen.tsx:15)
    in RCTView (at View.js:34)
    in View (at TestScreen.tsx:12)
    in TestScreen (at SceneView.tsx:122)`);

    console.log('Test crash logged successfully');
  } catch (error) {
    console.error('Failed to log test crash:', error);
  }
};

/**
 * Simulates a warning
 */
export const testWarning = async () => {
  await crashLogger.logWarning('This is a test warning', {
    component: 'TestComponent',
    action: 'testAction',
  });
  console.log('Test warning logged successfully');
};

/**
 * Simulates an info log
 */
export const testInfoLog = async () => {
  await crashLogger.logInfo('This is a test info log', {
    user: 'test@example.com',
    screen: 'TestScreen',
  });
  console.log('Test info logged successfully');
};

/**
 * Simulates a null pointer exception
 */
export const testNullPointerException = async () => {
  try {
    const obj: any = null;
    // This will throw a TypeError
    obj.someProperty.someMethod();
  } catch (error) {
    await crashLogger.logError(error as Error, {
      context: 'Null Pointer Exception Test',
      type: 'TypeError',
    });
    console.log('Null pointer exception logged successfully');
  }
};

/**
 * Simulates a network error
 */
export const testNetworkError = async () => {
  const error = new Error('Network request failed');
  error.name = 'NetworkError';

  await crashLogger.logError(error, {
    url: 'https://api.example.com/endpoint',
    method: 'GET',
    statusCode: 500,
  });
  console.log('Network error logged successfully');
};

/**
 * Runs all tests in sequence
 */
export const runAllTests = async () => {
  console.log('Starting crash logger tests...');

  await testBasicError();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testWarning();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testInfoLog();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testNullPointerException();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testNetworkError();
  await new Promise(resolve => setTimeout(resolve, 500));

  await testCrashWithStack();

  console.log('All crash logger tests completed!');
};
