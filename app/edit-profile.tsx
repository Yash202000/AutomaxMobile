import apiClient from "@/src/api/client";
import { getProfile, updateProfile } from "@/src/api/user";
import { CustomAlert } from "@/src/components/CustomAlert";
import { useAuth } from "@/src/context/AuthContext";
import i18n from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { t } from "i18next";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  I18nManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface iCustomInputProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  actionButton?: {
    id: string;
    label: string;
    onPress: () => void;
    show: boolean;
  }[];
  isVerified?: boolean;
}

const CustomInput = ({
  label,
  value,
  onChangeText,
  editable = true,
  actionButton,
  isVerified,
}: iCustomInputProps) => {
  const isRTL = I18nManager.isRTL;
  return (
    <View style={styles.inputWrapper}>
      <View style={styles.inputContainer}>
        <View style={styles.labelContainer}>
          <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
            {label}
          </Text>
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#2EC4B6" />
              <Text style={styles.verifiedText}>{t("profile.verified")}</Text>
            </View>
          )}
        </View>
        <TextInput
          style={[
            styles.textInput,
            !editable && styles.disabledInput,
            isRTL && styles.textRTL,
            { textAlign: i18n.language === "ar" ? "right" : "left" },
          ]}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
        />
      </View>
      <View style={styles.actionButtonContainer}>
        {actionButton?.map(
          (button) =>
            button.show && (
              <TouchableOpacity
                key={button.id}
                onPress={button.onPress}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>{button.label}</Text>
              </TouchableOpacity>
            ),
        )}
      </View>
    </View>
  );
};

const EditProfileScreenContent = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [originalFirstName, setOriginalFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [roles, setRoles] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [data, setData] = useState<any>(null);

  // OTP States
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [sessionId, setSessionId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpChannel, setOtpChannel] = useState<"sms" | "whatsapp">("sms");
  const [otpStep, setOtpStep] = useState<"channel" | "code">("channel");
  const [sendingOtp, setSendingOtp] = useState(false);
  const otpInputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const response = await getProfile();
        if (response.success) {
          const {
            first_name,
            last_name,
            email,
            phone,
            roles: userRoles,
            mobile_verified,
          } = response.data;
          setData(response.data);
          setFirstName(first_name || "");
          setOriginalFirstName(first_name || "");
          setLastName(last_name || "");
          setOriginalLastName(last_name || "");
          setEmail(email || "");
          setPhone(phone || "");
          setOriginalPhone(phone || "");
          setMobileVerified(mobile_verified || false);
          if (userRoles && Array.isArray(userRoles)) {
            setRoles(userRoles.map((role) => role.name).join(", "));
          }
        } else {
          CustomAlert.alert(t("common.error"), t("profile.fetchProfileFailed"));
        }
      } catch (error) {
        console.error("Fetch profile error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const isPhoneChanged = phone !== originalPhone;
    const profileData = {
      ...data,
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      extension: data.extension || "",
      mobile_verified: isPhoneChanged ? false : mobileVerified,
    };
    const response = await updateProfile(profileData);
    setSaving(false);
    if (response.success) {
      setOriginalPhone(phone);
      setOriginalFirstName(firstName);
      setOriginalLastName(lastName);
      if (response.data && response.data.mobile_verified !== undefined) {
        setMobileVerified(response.data.mobile_verified);
      } else if (isPhoneChanged) {
        setMobileVerified(false);
      }
      CustomAlert.alert(t("common.success"), t("profile.profileUpdated"), [
        {
          text: t("common.ok"),
          onPress: () => {
            // Stay on screen if they need to verify
          },
        },
      ]);
    } else {
      CustomAlert.alert(
        t("common.error"),
        response.error || t("profile.updateProfileFailed"),
      );
    }
  };

  const handleStartVerify = () => {
    if (!phone || phone.length < 10) {
      CustomAlert.alert(t("common.error"), t("errors.validationError"));
      return;
    }
    setOtpStep("channel");
    setOtpError("");
    setShowOtpModal(true);
  };

  const handleSendOTP = async () => {
    setSendingOtp(true);
    setOtpError("");
    try {
      const response = await apiClient.post("/otp/send", {
        phone: phone,
        channel: otpChannel,
      });

      if (response.data && response.data.session_id) {
        setSessionId(response.data.session_id);
        setOtp(new Array(6).fill(""));
        setOtpStep("code");
      } else {
        setOtpError(t("auth.otpSentFailed", "Failed to send OTP"));
      }
    } catch (err: any) {
      setOtpError(
        err.response?.data?.error ||
          t("auth.otpSentFailed", "Failed to send OTP"),
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async () => {
    const enteredOtp = otp.join("");
    if (enteredOtp.length < 6) return;

    setVerifying(true);
    setOtpError("");
    try {
      const response = await apiClient.post("/otp/verify", {
        phone: phone,
        session_id: sessionId,
        otp: enteredOtp,
      });

      if (response.data && response.data.success) {
        const updateRes = await updateProfile({
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          extension: data.extension || "",
          mobile_verified: true,
        });
        if (updateRes.success) {
          setMobileVerified(true);
          setOriginalPhone(phone);
          setShowOtpModal(false);
          CustomAlert.alert(t("common.success"), t("profile.phoneVerified"));
        } else {
          setOtpError(updateRes.error || t("profile.updateProfileFailed"));
        }
      } else {
        setOtpError(t("profile.invalidOTP"));
      }
    } catch (err: any) {
      setOtpError(err.response?.data?.error || t("profile.invalidOTP"));
    } finally {
      setVerifying(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    if (isNaN(Number(text))) return;
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text !== "" && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && otp[index] === "" && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2EC4B6" />
      </View>
    );
  }

  const isPhoneChanged = phone !== originalPhone;
  const hasChanges =
    isPhoneChanged ||
    firstName !== originalFirstName ||
    lastName !== originalLastName;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <View
              style={{
                flexDirection: "column",
                alignItems: "flex-start",
                paddingVertical: 16,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "bold" }}>
                {t("settings.profile")}
              </Text>
            </View>
            <CustomInput
              label={t("profile.firstName")}
              value={firstName}
              editable={false}
            />
            <CustomInput
              label={t("profile.lastName")}
              value={lastName}
              editable={false}
            />
            <CustomInput
              label={t("profile.mobileNo")}
              value={phone}
              editable={false}
              isVerified={mobileVerified}
            />
            <CustomInput
              label={t("profile.roles")}
              value={roles}
              editable={false}
            />

            {/* Placeholder to ensure content is not hidden by floating footer if any, 
                            though here footer is part of KAV */}
            <View style={{ height: 24 }} />
          </View>
        </ScrollView>

      </KeyboardAvoidingView>

      {/* OTP Verification Modal */}
      <Modal
        visible={showOtpModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOtpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("profile.verify")}</Text>
              <TouchableOpacity onPress={() => setShowOtpModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {otpStep === "channel" ? (
              <>
                <Text style={styles.modalSubTitle}>{t("auth.otpChannel")}</Text>
                <View style={styles.channelContainer}>
                  {(
                    [
                      {
                        id: "sms",
                        icon: "chatbubble-ellipses-outline",
                        label: t("profile.otpViaSms"),
                      },
                      {
                        id: "whatsapp",
                        icon: "logo-whatsapp",
                        label: t("profile.otpViaWhatsapp"),
                      },
                    ] as const
                  ).map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.channelButton,
                        otpChannel === option.id && styles.activeChannel,
                      ]}
                      onPress={() => setOtpChannel(option.id)}
                    >
                      <Ionicons
                        name={option.icon}
                        size={20}
                        color={otpChannel === option.id ? "#2EC4B6" : "#666"}
                      />
                      <Text
                        style={[
                          styles.channelText,
                          otpChannel === option.id && styles.activeChannelText,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {otpError ? (
                  <Text style={styles.errorText}>{otpError}</Text>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.verifyButton,
                    sendingOtp && styles.disabledButton,
                  ]}
                  onPress={handleSendOTP}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.verifyButtonText}>
                      {t("profile.sendOTP")}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalSubTitle}>
                  {t("profile.otpSentVia", {
                    channel:
                      otpChannel === "whatsapp"
                        ? t("profile.otpViaWhatsapp")
                        : t("profile.otpViaSms"),
                    phone,
                  })}
                </Text>

                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      style={[
                        styles.otpInput,
                        {
                          textAlign: i18n.language === "ar" ? "right" : "left",
                        },
                      ]}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={(e) => handleOtpKeyPress(e, index)}
                      keyboardType="numeric"
                      maxLength={1}
                      ref={(ref) => {
                        otpInputs.current[index] = ref;
                      }}
                    />
                  ))}
                </View>

                {otpError ? (
                  <Text style={styles.errorText}>{otpError}</Text>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.verifyButton,
                    (verifying || otp.join("").length < 6) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleVerifyOTP}
                  disabled={verifying || otp.join("").length < 6}
                >
                  {verifying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.verifyButtonText}>
                      {t("profile.verify")}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.changeChannelButton}
                  onPress={() => {
                    setOtpStep("channel");
                    setOtpError("");
                  }}
                  disabled={verifying}
                >
                  <Text style={styles.changeChannelText}>
                    {t("profile.changeOtpChannel")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  form: {
    paddingHorizontal: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  inputContainer: {
    flex: 1,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  inputLabel: {
    fontSize: 14,
    color: "#999",
    textAlign: "left",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FFFE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    color: "#2EC4B6",
    fontWeight: "bold",
  },
  textInput: {
    fontSize: 16,
    color: "#333",
    fontWeight: "bold",
    textAlign: "left",
  },
  textRTL: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  disabledInput: {
    color: "#999",
  },
  actionButtonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  actionButtonText: {
    color: "#2EC4B6",
    fontSize: 12,
    fontWeight: "bold",
  },
  actionButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: "#F0FFFE",
  },
  footer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    padding: 15,
    paddingBottom: Platform.OS === "ios" ? 0 : 15, // SafeAreaView handles iOS
  },
  saveButton: {
    backgroundColor: "#2EC4B6",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#CCC",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    width: "100%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  modalSubTitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  otpInput: {
    width: 42,
    height: 50,
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  verifyButton: {
    backgroundColor: "#2EC4B6",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  verifyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  errorText: {
    color: "#E74C3C",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 15,
  },
  channelContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 25,
  },
  channelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    gap: 8,
  },
  activeChannel: {
    backgroundColor: "#F0FBFA",
    borderColor: "#2EC4B6",
  },
  channelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  activeChannelText: {
    color: "#2EC4B6",
  },
  changeChannelButton: {
    marginTop: 15,
    alignItems: "center",
  },
  changeChannelText: {
    color: "#2EC4B6",
    fontSize: 14,
    fontWeight: "600",
  },
});

// Citizens log in with phone + OTP (no email/password), so they must not reach this screen.
const EditProfileScreen = () => {
  const { isCitizen } = useAuth();
  if (isCitizen) return <Redirect href="/(tabs)/setting" />;
  return <EditProfileScreenContent />;
};

export default EditProfileScreen;
