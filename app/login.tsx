import apiClient from "@/src/api/client";
import { ldapLogin } from "@/src/api/auth";
import { CustomAlert } from "@/src/components/CustomAlert";
import { useAuth } from "@/src/context/AuthContext";
import { getCurrentLanguage, setLanguage } from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import * as SecureStore from "expo-secure-store";
import { default as React, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: screenHeight } = Dimensions.get("window");
const isSmallScreen = screenHeight < 700;
const MOBILE_PHONE_MIN_DIGITS = 8;
const INTERNATIONAL_PHONE_MAX_DIGITS = 15;
const MOBILE_PHONE_REGEX = /^\+?\d{8,15}$/;

// Feature flag: show citizen login tab only when EXPO_PUBLIC_ENABLE_CITIZEN_LOGIN=true
const enableCitizenLogin =
  process.env.EXPO_PUBLIC_ENABLE_CITIZEN_LOGIN === "true";

const LoginScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [citizenName, setCitizenName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loginType, setLoginType] = useState<"employee" | "citizen">(
    enableCitizenLogin ? "citizen" : "employee"
  );
  const [loginMethod, setLoginMethod] = useState<"email" | "ad" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [adUsername, setAdUsername] = useState("");
  const [adPassword, setAdPassword] = useState("");
  const [showAdPassword, setShowAdPassword] = useState(false);
  const [isADPasswordFocused, setADPasswordFocused] = useState(false);
  const [isEmailPasswordFocused, setIsEmailPasswordFocused] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const [otpChannel, setOtpChannel] = useState<"sms" | "whatsapp">("sms");
  const version = Constants.expoConfig?.version;
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const emailFocusAnim = useRef(new Animated.Value(0)).current;
  const passwordFocusAnim = useRef(new Animated.Value(0)).current;
  const adUsernameFocusAnim = useRef(new Animated.Value(0)).current;
  const adPasswordFocusAnim = useRef(new Animated.Value(0)).current;
  const phoneFocusAnim = useRef(new Animated.Value(0)).current;
  const nameFocusAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  const trimmedCitizenName = citizenName.trim();
  const citizenPhoneDigits = phoneNumber.replace(/\D/g, "");
  const hasCitizenPhoneMinDigits =
    citizenPhoneDigits.length >= MOBILE_PHONE_MIN_DIGITS;
  const hasCitizenRequiredFields =
    Boolean(trimmedCitizenName) && hasCitizenPhoneMinDigits;
  const isCitizenPhoneValid = MOBILE_PHONE_REGEX.test(phoneNumber);
  const isLoginDisabled =
    loading ||
    (loginType === "citizen" && !hasCitizenRequiredFields) ||
    (loginType === "employee" &&
      (loginMethod === "email"
        ? !email || !password
        : loginMethod === "ad"
          ? !adUsername || !adPassword
          : !phoneNumber));
  const isButtonDimmed =
    loading ||
    (loginType === "citizen"
      ? !hasCitizenRequiredFields
      : loginMethod === "email"
        ? !email || !password
        : loginMethod === "ad"
          ? !adUsername || !adPassword
          : !phoneNumber);

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardActive(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardActive(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleLanguageChange = async (langCode: string) => {
    if (langCode === currentLang) return;

    try {
      await setLanguage(langCode);
      setCurrentLang(langCode);

      CustomAlert.alert(
        langCode === "ar" ? "نجاح" : "Success",
        langCode === "ar"
          ? "تم تغيير اللغة. سيتم إعادة تشغيل التطبيق لتطبيق التغييرات."
          : "Language changed. The app will restart to apply changes.",
        [
          {
            text: langCode === "ar" ? "موافق" : "OK",
            onPress: async () => {
              try {
                await Updates.reloadAsync();
              } catch {
                CustomAlert.alert(
                  langCode === "ar"
                    ? "إعادة التشغيل مطلوبة"
                    : "Restart Required",
                  langCode === "ar"
                    ? "يرجى إغلاق التطبيق وإعادة فتحه لتطبيق تغييرات اللغة."
                    : "Please close and reopen the app to apply language changes.",
                );
              }
            },
          },
        ],
      );
    } catch (error) {
      CustomAlert.alert(t("common.error"), t("errors.unknownError"));
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError("");
    setFieldErrors({});

    if (loginType === "citizen") {
      const nextFieldErrors: { name?: string; phone?: string } = {};

      if (!trimmedCitizenName) {
        nextFieldErrors.name = t("auth.nameRequired", "Please enter your name");
      }

      if (!phoneNumber) {
        nextFieldErrors.phone = t(
          "auth.mobileRequired",
          "Please enter your mobile number",
        );
      } else if (!isCitizenPhoneValid) {
        nextFieldErrors.phone = t(
          "auth.invalidMobileNumber",
          "Please enter a valid mobile number",
        );
      }

      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
        return;
      }

      setLoading(true);
      try {
        const response = await apiClient.post("/otp/send", {
          phone: phoneNumber,
          channel: otpChannel,
          name: trimmedCitizenName,
        });

        if (response.data && response.data.session_id) {
          router.push({
            pathname: "/otp",
            params: {
              phoneNumber,
              sessionId: response.data.session_id,
              channel: otpChannel,
            },
          });
        } else {
          setError(t("auth.otpSentFailed", "Failed to send OTP"));
        }
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
          t("auth.otpSentFailed", "Failed to send OTP"),
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const isEmail = loginMethod === "email";
    const isAd = loginMethod === "ad";

    if (isAd) {
      // AD (LDAP) Login Logic
      if (!adUsername.trim() || !adPassword) {
        setError(t("errors.validationError"));
        return;
      }
      setLoading(true);
      try {
        const result = await ldapLogin(adUsername.trim(), adPassword);
        if (result.success && result.token) {
          await SecureStore.setItemAsync('loginMethod', 'ad');
          await login(result.token, result.refresh_token);
          router.replace("/(tabs)/explore");
        } else {
          setError(result.error || t("auth.loginError"));
        }
      } catch (err: any) {
        setError(err.message || t("auth.loginError"));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isEmail) {
      // Email Login Logic
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        setError(t("errors.validationError"));
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setError(t("auth.invalidCredentials"));
        return;
      }

      setLoading(true);

      try {
        const response = await apiClient.post("/auth/login", {
          email: trimmedEmail,
          password,
        });

        if (response.data && response.data.success) {
          const { token, refresh_token } = response.data.data;
          await login(token, refresh_token);
          router.replace("/(tabs)/explore");
        } else {
          setError(t("auth.loginError"));
        }
      } catch (err: any) {
        let errorMessage = t("auth.loginError");
        if (err.response?.data) {
          const remoteError =
            err.response.data.error || err.response.data.message;
          if (remoteError) {
            errorMessage =
              typeof remoteError === "string"
                ? remoteError
                : JSON.stringify(remoteError);
          }
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    } else {
      // Phone OTP Login Logic
      if (!phoneNumber) {
        setError(t("errors.validationError"));
        return;
      }

      setLoading(true);
      try {
        const authResponse = await apiClient.post("/auth/login", {
          phone: phoneNumber,
        });
        if (!authResponse.data || !authResponse.data.success) {
          setError(authResponse.data?.message || t("auth.loginError"));
          return;
        }
        // Updated OTP send endpoint and payload based on user curl
        const response = await apiClient.post("/otp/send", {
          phone: phoneNumber,
          channel: otpChannel,
        });

        if (response.data && response.data.session_id) {
          router.push({
            pathname: "/otp",
            params: {
              phoneNumber,
              sessionId: response.data.session_id,
              channel: otpChannel,
            },
          });
        } else {
          setError(t("auth.otpSentFailed", "Failed to send OTP"));
        }
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
          t("auth.otpSentFailed", "Failed to send OTP"),
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCitizenNameChange = (value: string) => {
    setCitizenName(value);
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const resetLoginFields = () => {
    setEmail("");
    setPassword("");
    setAdUsername("");
    setAdPassword("");
    setCitizenName("");
    setPhoneNumber("");
    setShowPassword(false);
    setShowAdPassword(false);
    setError("");
    setFieldErrors({});
  };

  const handlePhoneNumberChange = (value: string) => {
    const trimmedValue = value.trim();
    const digits = trimmedValue
      .replace(/\D/g, "")
      .slice(0, INTERNATIONAL_PHONE_MAX_DIGITS);
    const normalizedValue = trimmedValue.startsWith("+")
      ? `+${digits}`
      : digits;
    setPhoneNumber(normalizedValue);
    if (fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const handleNameFocus = () => {
    Animated.spring(nameFocusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handleNameBlur = () => {
    Animated.spring(nameFocusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const handlePhoneFocus = () => {
    Animated.spring(phoneFocusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handlePhoneBlur = () => {
    Animated.spring(phoneFocusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const handleEmailFocus = () => {
    Animated.spring(emailFocusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handleEmailBlur = () => {
    Animated.spring(emailFocusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const handlePasswordFocus = () => {
    Animated.spring(passwordFocusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handlePasswordBlur = () => {
    Animated.spring(passwordFocusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const emailBorderColor = emailFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#E5E5E5", "#2EC4B6"],
  });

  const passwordBorderColor = passwordFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#E5E5E5", "#2EC4B6"],
  });

  const phoneBorderColor = phoneFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#E5E5E5", "#2EC4B6"],
  });

  const nameBorderColor = nameFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#E5E5E5", "#2EC4B6"],
  });

  const adUsernameBorderColor = adUsernameFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#E5E5E5", "#2EC4B6"],
  });

  // const adPasswordBorderColor = adPasswordFocusAnim.interpolate({
  //   inputRange: [0, 1],
  //   outputRange: ["#E5E5E5", "#2EC4B6"],
  // });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboardView}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <LinearGradient
        colors={["#F8FFFE", "#FFFFFF"]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Decorative circles */}
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardActive && { paddingBottom: 300 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                paddingTop: isSmallScreen ? 30 : 60,
              },
            ]}
          >
            {/* Header Logo */}
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <View style={styles.logoShadow}>
                <Image
                  source={require("@/assets/images/start-logo.png")}
                  style={styles.headerLogo}
                />
              </View>
            </Animated.View>

            {/* Welcome Text */}
            {
              !isKeyboardActive &&
              <View style={styles.welcomeContainer}>
                <Text
                  style={[
                    styles.welcomeText,
                    { textAlign: currentLang === "ar" ? "right" : "left" },
                  ]}
                >
                  {t("auth.welcomeBack")}
                </Text>
                <Text
                  style={[
                    styles.subtitleText,
                    { textAlign: currentLang === "ar" ? "right" : "left" },
                  ]}
                >
                  {t("auth.loginSubtitle")}
                </Text>
              </View>
            }

            {/* Login Type Tabs — visible only when citizen login is enabled */}
            {enableCitizenLogin && (
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    loginType === "citizen" && styles.activeTab,
                  ]}
                  onPress={() => {
                    setLoginType("citizen");
                    setLoginMethod("phone");
                    resetLoginFields();
                  }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      loginType === "citizen" && styles.activeTabText,
                    ]}
                  >
                    {t("auth.citizenLogin")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    loginType === "employee" && styles.activeTab,
                  ]}
                  onPress={() => {
                    setLoginType("employee");
                    setLoginMethod("email");
                    resetLoginFields();
                  }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      loginType === "employee" && styles.activeTabText,
                    ]}
                  >
                    {t("auth.employeeLogin")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Employee method pill — Email / AD / Phone, only when citizen login is also enabled */}
            {loginType === "employee" && enableCitizenLogin && (
              <View style={styles.methodPillContainer}>
                {(["email", "ad", "phone"] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.methodPillButton,
                      loginMethod === method && styles.methodPillActive,
                    ]}
                    onPress={() => {
                      setLoginMethod(method);
                      resetLoginFields();
                    }}
                  >
                    <Text
                      style={[
                        styles.methodPillText,
                        loginMethod === method && styles.methodPillTextActive,
                      ]}
                    >
                      {method === "email"
                        ? t("auth.loginEmail", "Email")
                        : method === "ad"
                          ? t("auth.adLogin", "AD Login")
                          : t("auth.loginMobile", "Phone")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}


            {/* Input Fields Container */}
            <View style={styles.inputsContainer}>
              {loginType === "citizen" ? (
                <>
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { textAlign: currentLang === "ar" ? "right" : "left" },
                      ]}
                    >
                      {t("auth.name", "Name")}
                    </Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        {
                          borderColor: fieldErrors.name
                            ? "#E74C3C"
                            : nameBorderColor,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            textAlign: currentLang === "ar" ? "right" : "left",
                          },
                        ]}
                        placeholder={t(
                          "auth.namePlaceholder",
                          "Enter your name",
                        )}
                        placeholderTextColor="#999"
                        value={citizenName}
                        onChangeText={handleCitizenNameChange}
                        onFocus={handleNameFocus}
                        onBlur={handleNameBlur}
                        autoCapitalize="words"
                        autoCorrect={false}
                      />
                    </Animated.View>
                    {fieldErrors.name ? (
                      <Text style={styles.fieldErrorText}>
                        {fieldErrors.name}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { textAlign: currentLang === "ar" ? "right" : "left" },
                      ]}
                    >
                      {t("auth.mobileNumber", "Mobile Number")}
                    </Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        {
                          borderColor: fieldErrors.phone
                            ? "#E74C3C"
                            : phoneBorderColor,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <Ionicons
                        name="call-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            textAlign: currentLang === "ar" ? "right" : "left",
                          },
                        ]}
                        placeholder={t("auth.mobilePlaceholder", {
                          defaultValue: "12345678",
                        })}
                        placeholderTextColor="#999"
                        value={phoneNumber}
                        onChangeText={handlePhoneNumberChange}
                        onFocus={handlePhoneFocus}
                        onBlur={handlePhoneBlur}
                        keyboardType="phone-pad"
                        maxLength={INTERNATIONAL_PHONE_MAX_DIGITS + 1}
                      />
                    </Animated.View>
                    {fieldErrors.phone ? (
                      <Text style={styles.fieldErrorText}>
                        {fieldErrors.phone}
                      </Text>
                    ) : null}
                  </View>

                  {/* OTP Channel Selection */}
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { textAlign: currentLang === "ar" ? "right" : "left" },
                      ]}
                    >
                      {t("auth.otpChannel")}
                    </Text>
                    <View style={styles.channelContainer}>
                      <TouchableOpacity
                        style={[
                          styles.channelButton,
                          otpChannel === "sms" && styles.activeChannel,
                        ]}
                        onPress={() => setOtpChannel("sms")}
                      >
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={20}
                          color={otpChannel === "sms" ? "#2EC4B6" : "#666"}
                        />
                        <Text
                          style={[
                            styles.channelText,
                            otpChannel === "sms" && styles.activeChannelText,
                          ]}
                        >
                          {t("auth.sms")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.channelButton,
                          otpChannel === "whatsapp" && styles.activeChannel,
                        ]}
                        onPress={() => setOtpChannel("whatsapp")}
                      >
                        <Ionicons
                          name="logo-whatsapp"
                          size={20}
                          color={otpChannel === "whatsapp" ? "#2EC4B6" : "#666"}
                        />
                        <Text
                          style={[
                            styles.channelText,
                            otpChannel === "whatsapp" &&
                            styles.activeChannelText,
                          ]}
                        >
                          {t("auth.whatsapp")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : loginMethod === "ad" ? (
                /* AD (LDAP) Login */
                <>
                  {/* Username Input */}
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { textAlign: currentLang === "ar" ? "right" : "left" },
                      ]}
                    >
                      {t("auth.adUsername", "Username")}
                    </Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        { borderColor: adUsernameBorderColor, borderWidth: 2 },
                      ]}
                    >
                      <Ionicons
                        name="person-circle-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          { textAlign: currentLang === "ar" ? "right" : "left" },
                        ]}
                        placeholder={t("auth.adUsernamePlaceholder", "domain\\username or username")}
                        placeholderTextColor="#999"
                        value={adUsername}
                        onChangeText={setAdUsername}
                        onFocus={() =>
                          Animated.spring(adUsernameFocusAnim, { toValue: 1, useNativeDriver: false }).start()
                        }
                        onBlur={() =>
                          Animated.spring(adUsernameFocusAnim, { toValue: 0, useNativeDriver: false }).start()
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </Animated.View>
                  </View>

                  {/* AD Password Input */}
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { textAlign: currentLang === "ar" ? "right" : "left" },
                      ]}
                    >
                      {t("auth.password")}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        { borderColor: isADPasswordFocused ? "#2EC4B6" : "#E5E5E5", borderWidth: 2 },
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          { textAlign: currentLang === "ar" ? "right" : "left" },
                        ]}
                        placeholder={t("auth.passwordPlaceholder", "••••••••")}
                        placeholderTextColor="#999"
                        secureTextEntry={!showAdPassword}
                        value={adPassword}
                        onChangeText={setAdPassword}
                        onFocus={() =>
                          setADPasswordFocused(true)
                        }
                        onBlur={() =>
                          setADPasswordFocused(false)
                        }
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowAdPassword(!showAdPassword)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={showAdPassword ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* AD badge */}
                  <View style={styles.adBadgeRow}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="#6366F1" />
                    <Text style={styles.adBadgeText}>
                      {t("auth.adDescription", "Sign in with your Active Directory credentials")}
                    </Text>
                  </View>
                </>
              ) : loginMethod === "email" ? (
                <>
                  {/* Email Input */}
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { textAlign: currentLang === "ar" ? "right" : "left" },
                      ]}
                    >
                      {t("auth.email")}
                    </Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        {
                          borderColor: emailBorderColor,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            textAlign: currentLang === "ar" ? "right" : "left",
                          },
                        ]}
                        placeholder={t(
                          "auth.emailPlaceholder",
                          "user@example.com",
                        )}
                        placeholderTextColor="#999"
                        value={email}
                        onChangeText={setEmail}
                        onFocus={handleEmailFocus}
                        onBlur={handleEmailBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </Animated.View>
                  </View>

                  {/* Password Input */}
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { textAlign: currentLang === "ar" ? "right" : "left" },
                      ]}
                    >
                      {t("auth.password")}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        {
                          borderColor: isEmailPasswordFocused ? "#2EC4B6" : "#E5E5E5",
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            textAlign: currentLang === "ar" ? "right" : "left",
                          },
                        ]}
                        placeholder={t("auth.passwordPlaceholder", "••••••••")}
                        placeholderTextColor="#999"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setIsEmailPasswordFocused(true)}
                        onBlur={() => setIsEmailPasswordFocused(false)}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={
                            showPassword ? "eye-off-outline" : "eye-outline"
                          }
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                /* Phone Number Input */
                <>
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { textAlign: currentLang === "ar" ? "right" : "left" },
                      ]}
                    >
                      {t("auth.phone")}
                    </Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        {
                          borderColor: phoneBorderColor,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <Ionicons
                        name="call-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            textAlign: currentLang === "ar" ? "right" : "left",
                          },
                        ]}
                        placeholder={t("auth.phonePlaceholder", "+1234567890")}
                        placeholderTextColor="#999"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        onFocus={handlePhoneFocus}
                        onBlur={handlePhoneBlur}
                        keyboardType="phone-pad"
                      />
                    </Animated.View>
                  </View>

                  {/* OTP Channel Selection */}
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { textAlign: currentLang === "ar" ? "right" : "left" },
                      ]}
                    >
                      {t("auth.otpChannel")}
                    </Text>
                    <View style={styles.channelContainer}>
                      <TouchableOpacity
                        style={[
                          styles.channelButton,
                          otpChannel === "sms" && styles.activeChannel,
                        ]}
                        onPress={() => setOtpChannel("sms")}
                      >
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={20}
                          color={otpChannel === "sms" ? "#2EC4B6" : "#666"}
                        />
                        <Text
                          style={[
                            styles.channelText,
                            otpChannel === "sms" && styles.activeChannelText,
                          ]}
                        >
                          {t("auth.sms")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.channelButton,
                          otpChannel === "whatsapp" && styles.activeChannel,
                        ]}
                        onPress={() => setOtpChannel("whatsapp")}
                      >
                        <Ionicons
                          name="logo-whatsapp"
                          size={20}
                          color={otpChannel === "whatsapp" ? "#2EC4B6" : "#666"}
                        />
                        <Text
                          style={[
                            styles.channelText,
                            otpChannel === "whatsapp" &&
                            styles.activeChannelText,
                          ]}
                        >
                          {t("auth.whatsapp")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Forgot Password - Only for email login */}
              {loginType === "employee" && loginMethod === "email" && (
                <TouchableOpacity
                  onPress={() => router.push("/forgot-password")}
                  style={[
                    styles.forgotPasswordContainer,
                    {
                      alignSelf:
                        currentLang === "ar" ? "flex-start" : "flex-end",
                    },
                  ]}
                >
                  <Text style={styles.forgotPasswordText}>
                    {t("auth.forgotPassword")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Error Message */}
            {error ? (
              <Animated.View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#E74C3C" />
                <Text style={styles.errorText}>
                  {error.charAt(0).toUpperCase() + error.slice(1)}
                </Text>
              </Animated.View>
            ) : null}

            {/* Login Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={handleButtonPressIn}
                onPressOut={handleButtonPressOut}
                onPress={handleLogin}
                disabled={isLoginDisabled}
                style={styles.loginButton}
              >
                <LinearGradient
                  colors={
                    isButtonDimmed
                      ? ["#CCCCCC", "#AAAAAA"]
                      : ["#2EC4B6", "#20B2A3"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {loginType === "citizen" || loginMethod === "phone"
                        ? t("auth.sendOTP")
                        : loginMethod === "ad"
                          ? t("auth.adLoginButton", "Sign In with AD")
                          : t("auth.login")}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>

        {/* Footer — outside ScrollView so it's always visible */}
        {!isKeyboardActive && (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(20, insets.bottom + 10) },
            ]}
          >
            <View style={styles.languageContainer}>
              <TouchableOpacity
                style={[
                  styles.languageButton,
                  currentLang === "en" && styles.activeLanguage,
                ]}
                onPress={() => handleLanguageChange("en")}
                activeOpacity={0.7}
              >
                <Text
                  style={
                    currentLang === "en"
                      ? styles.activeLanguageText
                      : styles.languageText
                  }
                >
                  EN
                </Text>
              </TouchableOpacity>
              <View style={styles.languageDivider} />
              <TouchableOpacity
                style={[
                  styles.languageButton,
                  currentLang === "ar" && styles.activeLanguage,
                ]}
                onPress={() => handleLanguageChange("ar")}
                activeOpacity={0.7}
              >
                <Text
                  style={
                    currentLang === "ar"
                      ? styles.activeLanguageText
                      : styles.languageText
                  }
                >
                  AR
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.versionText}>
              {t("auth.version", { version })}
            </Text>
          </View>
        )}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    // backgroundColor: '#F8FFFE',
  },
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  decorativeCircle1: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(46, 196, 182, 0.06)",
  },
  decorativeCircle2: {
    position: "absolute",
    bottom: -100,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(46, 196, 182, 0.04)",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logoContainer: {
    alignSelf: "flex-start",
    marginBottom: isSmallScreen ? 16 : 32,
  },
  logoShadow: {
    shadowColor: "#2EC4B6",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerLogo: {
    width: 64,
    height: 64,
    resizeMode: "contain",
  },
  welcomeContainer: {
    marginBottom: isSmallScreen ? 20 : 40,
  },
  welcomeText: {
    fontSize: isSmallScreen ? 26 : 32,
    fontWeight: "800",
    marginBottom: 6,
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: "#666",
    fontWeight: "500",
  },
  inputsContainer: {
    marginBottom: isSmallScreen ? 12 : 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  activeTabText: {
    color: "#2EC4B6",
  },
  methodToggleContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  methodToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  methodToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2EC4B6",
    marginLeft: 8,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    direction: "ltr",
  },
  inputIcon: {
    marginEnd: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: "#333",
  },
  eyeButton: {
    padding: 8,
  },
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    marginTop: 4,
  },
  forgotPasswordText: {
    fontWeight: "600",
  },
  channelContainer: {
    flexDirection: "row",
    gap: 12,
  },
  channelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    gap: 8,
  },
  activeChannel: {
    borderColor: "#2EC4B6",
    backgroundColor: "#F0FFFE",
  },
  channelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  activeChannelText: {
    color: "#2EC4B6",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#E74C3C",
  },
  errorText: {
    color: "#E74C3C",
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  fieldErrorText: {
    color: "#E74C3C",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "500",
  },
  loginButton: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#2EC4B6",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  loginButtonGradient: {
    paddingVertical: isSmallScreen ? 14 : 18,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  languageContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  languageButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  activeLanguage: {
    backgroundColor: "#2EC4B6",
  },
  languageDivider: {
    width: 1,
    backgroundColor: "#E5E5E5",
  },
  activeLanguageText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  languageText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 14,
  },
  versionText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  methodPillContainer: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  methodPillButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  methodPillActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  methodPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
  },
  methodPillTextActive: {
    color: "#2EC4B6",
  },
  adBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  adBadgeText: {
    fontSize: 12,
    color: "#6366F1",
    fontWeight: "500",
  },
  tabContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    marginBottom: 20,
  },
});

export default LoginScreen;
