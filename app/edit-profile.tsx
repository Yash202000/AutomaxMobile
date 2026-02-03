import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getProfile, updateProfile } from '@/src/api/user';

const CustomInput = ({ label, value, onChangeText, editable = true }) => {
    const isRTL = I18nManager.isRTL;
    return (
        <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>{label}</Text>
            <TextInput
                style={[
                    styles.textInput,
                    !editable && styles.disabledInput,
                    isRTL && styles.textRTL
                ]}
                value={value}
                onChangeText={onChangeText}
                editable={editable}
            />
        </View>
    );
};


const EditProfileScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
        setLoading(true);
        const response = await getProfile();
        if (response.success) {
            const { first_name, last_name, email, phone, roles: userRoles } = response.data;
            setFirstName(first_name || '');
            setLastName(last_name || '');
            setEmail(email || '');
            setPhone(phone || '');
            if (userRoles && Array.isArray(userRoles)) {
                setRoles(userRoles.map(role => role.name).join(', '));
            }
        } else {
            Alert.alert(t('common.error'), t('profile.fetchProfileFailed'));
        }
        setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const profileData = { first_name: firstName, last_name: lastName, phone };
    const response = await updateProfile(profileData);
    setSaving(false);
    if (response.success) {
        Alert.alert(t('common.success'), t('profile.profileUpdated'), [
            { text: t('common.ok'), onPress: () => router.back() }
        ]);
    } else {
        Alert.alert(t('common.error'), `${t('profile.updateProfileFailed')}: ${response.error}`);
    }
  };

  if (loading) {
      return <View style={styles.centered}><ActivityIndicator size="large" /></View>
  }

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView>
            <View style={styles.form}>
                <CustomInput label={t('profile.firstName')} value={firstName} onChangeText={setFirstName} />
                <CustomInput label={t('profile.lastName')} value={lastName} onChangeText={setLastName} />
                <CustomInput label={t('profile.enterYourEmail')} value={email} editable={false} />
                <CustomInput label={t('profile.mobileNo')} value={phone} onChangeText={setPhone} />
                <CustomInput label={t('profile.roles')} value={roles} editable={false} />
            </View>
        </ScrollView>
        <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{t('profile.save')}</Text>}
        </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    form: {
        padding: 20,
    },
    inputContainer: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
    },
    inputLabel: {
        fontSize: 14,
        color: '#999',
        marginBottom: 5,
        textAlign: 'left',
    },
    textInput: {
        fontSize: 16,
        color: '#333',
        fontWeight: 'bold',
        textAlign: 'left',
    },
    textRTL: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    disabledInput: {
        color: '#999',
    },
    saveButton: {
        backgroundColor: '#2EC4B6',
        padding: 20,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#999',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default EditProfileScreen;
