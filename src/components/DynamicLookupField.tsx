import { LookupCategory } from '@/src/api/lookups';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { t } from 'i18next';
import React, { useState } from 'react';
import {
  FlatList,
  KeyboardTypeOptions,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import i18n from '../i18n';

import { IncidentMentionTextarea } from './IncidentMentionTextarea';

interface MultiValueFieldProps {
  keyboardType: KeyboardTypeOptions;
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
}

// Accumulates entries into a list instead of replacing a single value — e.g.
// a "Visit Number" field where every transition adds a new visit number
// without discarding the ones already recorded.
const MultiValueField: React.FC<MultiValueFieldProps> = ({
  keyboardType,
  values,
  onChange,
  label,
  required,
  error,
  placeholder,
}) => {
  const [draft, setDraft] = useState('');

  const addDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...values, trimmed]);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      {values.length > 0 && (
        <View style={styles.chipRow}>
          {values.map((v, index) => (
            <View key={`${v}-${index}`} style={styles.chip}>
              <Text style={styles.chipText}>{v}</Text>
              <TouchableOpacity
                onPress={() => onChange(values.filter((_, i) => i !== index))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={14} color="#2EC4B6" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={styles.multiValueInputRow}>
        <TextInput
          style={[
            styles.input,
            styles.multiValueInput,
            error && styles.inputError,
            { textAlign: i18n.language === 'ar' ? 'right' : 'left' },
          ]}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor="#999"
          keyboardType={keyboardType}
          onSubmitEditing={addDraft}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addButton, !draft.trim() && styles.addButtonDisabled]}
          onPress={addDraft}
          disabled={!draft.trim()}
        >
          <Text style={styles.addButtonText}>{t('common.add', 'Add')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hintText}>
        {t(
          'lookups.multipleValuesHint',
          'Tap Add or Done — previously added values are kept.',
        )}
      </Text>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

interface DynamicLookupFieldProps {
  category: LookupCategory;
  value: any;
  onChange: (categoryId: string, value: any) => void;
  required?: boolean;
  error?: string;
  mentionFilters?: {
    classification_ids?: string[];
    location_ids?: string[];
    currentIncident_ids?: string[];
  };
  // Transition field_changes are submitted as a single string per field per
  // transition (accumulation happens across transitions, on the backend —
  // see incident_service.go), unlike the incident create/edit form's
  // custom_fields, which can genuinely hold an array in one save. Pass this
  // from the transition step so "allow multiple values" categories still
  // render as a single input there instead of the chip/tag list.
  singleValueOnly?: boolean;
}

export const DynamicLookupField: React.FC<DynamicLookupFieldProps> = ({
  category,
  value,
  onChange,
  required = false,
  error,
  mentionFilters,
  singleValueOnly = false,
}) => {
  const fieldType = category.field_type || 'select';
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const fieldLabel =
    i18n.language === 'ar' ? category?.name_ar || category.name : category.name;

  // Parse validation rules
  let validationRules: any = {};
  if (category.validation_rules) {
    try {
      validationRules = JSON.parse(category.validation_rules);
    } catch {
      validationRules = {};
    }
  }

  const handleChange = (newValue: any) => {
    onChange(category.id, newValue);
  };

  const renderLabel = () => (
    <Text style={styles.label}>
      {fieldLabel} {required && <Text style={styles.required}>*</Text>}
    </Text>
  );

  switch (fieldType) {
    case 'text':
      if (validationRules.allowMultiple && !singleValueOnly) {
        return (
          <MultiValueField
            keyboardType="default"
            values={Array.isArray(value) ? value : []}
            onChange={handleChange}
            label={fieldLabel}
            required={required}
            error={error}
            placeholder={`${t('common.enter')} ${fieldLabel}`}
          />
        );
      }
      return (
        <View style={styles.container}>
          {renderLabel()}
          <TextInput
            style={[styles.input, error && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
            value={value || ''}
            onChangeText={handleChange}
            placeholder={`${t('common.enter')} ${fieldLabel}`}
            placeholderTextColor="#999"
            maxLength={validationRules.maxLength}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      );

    case 'textarea':
      return (
        <View style={styles.container}>
          {renderLabel()}
          {mentionFilters ? (
            <IncidentMentionTextarea
              style={[styles.textArea, error && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
              value={value || ''}
              onChangeText={handleChange}
              placeholder={`${t('common.enter')} ${fieldLabel}. You can tag incident using '@'`}
              filters={mentionFilters}
              maxLength={validationRules.maxLength}
            />
          ) : (
            <TextInput
              style={[styles.textArea, error && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
              value={value || ''}
              onChangeText={handleChange}
              placeholder={`${t('common.enter')} ${fieldLabel}`}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              maxLength={validationRules.maxLength}
            />
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      );

    case 'number':
      if (validationRules.allowMultiple && !singleValueOnly) {
        return (
          <MultiValueField
            keyboardType="numeric"
            values={Array.isArray(value) ? value : []}
            onChange={handleChange}
            label={fieldLabel}
            required={required}
            error={error}
            placeholder={`${t('common.enter')} ${fieldLabel}`}
          />
        );
      }
      return (
        <View style={styles.container}>
          {renderLabel()}
          <TextInput
            style={[styles.input, error && styles.inputError, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
            value={value?.toString() || ''}
            onChangeText={(text) => {
              const num = parseFloat(text);
              handleChange(isNaN(num) ? null : num);
            }}
            placeholder={`${t('common.enter')} ${fieldLabel}`}
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      );

    case 'date':
      return (
        <View style={styles.container}>
          {renderLabel()}
          <TouchableOpacity
            style={[styles.dateButton, error && styles.inputError]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={value ? styles.dateText : styles.placeholderText}>
              {value ? new Date(value).toLocaleString('en-GB') : `${t('common.select')} ${fieldLabel}`}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#666" />
          </TouchableOpacity>
          {error && <Text style={styles.errorText}>{error}</Text>}

          {showDatePicker && (
            <DateTimePicker
              value={value ? new Date(value) : new Date()}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  handleChange(selectedDate.toISOString());
                }
              }}
            />
          )}
        </View>
      );

    case 'checkbox':
      return (
        <View style={styles.container}>
          <View style={styles.checkboxRow}>
            <Text style={styles.label}>
              {fieldLabel} {required && <Text style={styles.required}>*</Text>}
            </Text>
            <Switch
              value={value || false}
              onValueChange={handleChange}
              trackColor={{ false: '#ddd', true: '#2EC4B6' }}
              thumbColor={value ? '#fff' : '#f4f3f4'}
            />
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      );

    case 'select':
      const selectOptions = (category.values || [])
        .filter(v => v.is_active)
        .map(v => ({ id: v.id, name: i18n.language === 'ar' ? v?.name_ar || v.name : v.name }));

      return (
        <View style={styles.container}>
          {renderLabel()}
          <TouchableOpacity
            style={[styles.dropdown, error && styles.inputError]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
              {selectOptions.find(opt => opt.id === value)?.name || `${t('common.select')} ${fieldLabel}`}
            </Text>
            <FontAwesome name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Modal
            visible={modalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setModalVisible(false)}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{fieldLabel}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={selectOptions}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => {
                        handleChange(item.id);
                        setModalVisible(false);
                      }}
                    >
                      <Text style={styles.optionText}>{item.name}</Text>
                      {value === item.id && (
                        <Ionicons name="checkmark" size={20} color="#2EC4B6" />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      );

    case 'multiselect':
      const multiselectOptions = (category.values || [])
        .filter(v => v.is_active)
        .map(v => ({ id: v.id, name: i18n.language === 'ar' ? v?.name_ar || v.name : v.name }));

      const selectedValues = Array.isArray(value) ? value : [];

      return (
        <View style={styles.container}>
          {renderLabel()}
          <TouchableOpacity
            style={[styles.dropdown, error && styles.inputError]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={[styles.dropdownText, selectedValues.length === 0 && styles.placeholderText]}>
              {selectedValues.length > 0
                ? `${selectedValues.length} selected`
                : `${t('common.select')} ${fieldLabel}`}
            </Text>
            <FontAwesome name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Modal
            visible={modalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setModalVisible(false)}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{fieldLabel}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={multiselectOptions}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isSelected = selectedValues.includes(item.id);
                    return (
                      <TouchableOpacity
                        style={styles.optionItem}
                        onPress={() => {
                          const newValue = isSelected
                            ? selectedValues.filter(id => id !== item.id)
                            : [...selectedValues, item.id];
                          handleChange(newValue);
                        }}
                      >
                        <Text style={styles.optionText}>{item.name}</Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#2EC4B6" />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      );

    default:
      return null;
  }
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'left'
  },
  required: {
    color: '#E74C3C',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAFBF9',
    borderWidth: 1,
    borderColor: '#2EC4B6',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F766E',
  },
  multiValueInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  multiValueInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#2EC4B6',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: 4,
    textAlign: "left"
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
});
