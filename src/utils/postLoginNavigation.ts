import type { Router } from 'expo-router';
import { t } from 'i18next';
import { sendOtp } from '../api/auth';
import { getSettings } from '../api/common';
import { CustomAlert } from '../components/CustomAlert';
import type { User } from '../context/AuthContext';

// Same viewer-role check previously duplicated across every login branch
// (email/ad/sso in app/login.tsx, citizen/phone in app/otp.tsx).
export function routeToDashboard(user: User | null, router: Router) {
  const isViewerApp = process.env.EXPO_PUBLIC_VIEWER_APP === 'true';
  const viewerRoles = (process.env.EXPO_PUBLIC_VIEWER_APP_ROLES || '').split(',');
  const isViewerRole = user?.roles?.some(role => viewerRoles.includes(role.code)) ?? false;
  const isViewerMode = isViewerApp && isViewerRole;
  router.replace(isViewerMode ? '/(tabs)/incident' : '/(tabs)/explore');
}

interface NavigateAfterLoginOptions {
  // Whether this login path requires the account's phone to already be
  // verified before reaching the dashboard. Only employee email/password
  // does — AD/SSO and citizen/employee phone+OTP logins don't (the latter
  // already prove phone ownership via the OTP step itself).
  enforcePhoneVerification: boolean;
  // Channel for the settings-driven 2FA OTP below, per the user's "Send OTP
  // via WhatsApp" checkbox on the login form. Defaults to 'sms'.
  otpChannel?: 'sms' | 'whatsapp';
  // Skip the settings-driven 2FA OTP step below — for login paths that are
  // themselves already phone+OTP based (citizen tab, employee "phone"
  // method), where a second OTP prompt would just repeat the login step
  // that was just completed.
  skipTotpCheck?: boolean;
}

// Single funnel every login success (and both gate screens) routes through:
// unverified phone -> /verify-phone -> (once verified) settings-driven OTP
// gate -> (if enabled) /otp -> dashboard.
export async function navigateAfterLogin(user: User | null, router: Router, opts: NavigateAfterLoginOptions) {
  if (opts.enforcePhoneVerification && !user?.mobile_verified) {
    router.replace('/verify-phone');
    return;
  }

  if (opts.skipTotpCheck) {
    routeToDashboard(user, router);
    return;
  }

  const settings = await getSettings();
  // if (settings.data) settings.data.auth_setting = { totp_enabled: true }
  const totpEnabled = settings.success && settings.data?.auth_setting?.totp_enabled === true;

  if (totpEnabled) {
    // 2FA is mandatory when enabled — never fall through to the dashboard
    // without it, whether that's because there's no phone on file or the
    // OTP send call itself failed.
    if (!user?.phone) {
      CustomAlert.alert(t('common.error'), t('auth.otpSentFailed', 'Failed to send OTP'));
      return;
    }

    const channel = opts.otpChannel || 'sms';
    const otpRes = await sendOtp(user.phone, channel);
    if (otpRes.success) {
      router.replace({
        pathname: '/otp',
        params: {
          phoneNumber: user.phone,
          sessionId: otpRes.session_id,
          channel,
          securityCheck: 'true',
        },
      });
      return;
    }

    CustomAlert.alert(t('common.error'), otpRes.error || t('auth.otpSentFailed', 'Failed to send OTP'));
    return;
  }

  routeToDashboard(user, router);
}
