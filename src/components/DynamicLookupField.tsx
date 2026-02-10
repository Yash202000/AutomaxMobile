import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { LookupCategory } from '@/src/api/lookups';

interface DynamicLookupFieldProps {
  category: LookupCategory;
  value: any;
  onChange: (categoryId: string, value: any) => void;
  required?: boolean;
  error?: string;
}

export const DynamicLookupField: React.FC<DynamicLookupFieldProps> = ({
  category,
  value,
  onChange,
  required = false,
  error,
}) => {
  const fieldType = category.field_type || 'select';
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Parse validation rules
  let validationRules: any = {};
  if (category.validation_rules) {
    try {
      validationRules = JSON.parse(category.validation_rules);
    } catch (e) {
      validationRules = {};
    }
  }

  const handleChange = (newValue: any) => {
    onChange(category.id, newValue);
  };

  const renderLabel = () => (
    <Text style={styles.label}>
      {category.name} {required && <Text style={styles.required}>*</Text>}
    </Text>
  );

  switch (fieldType) {
    case 'text':
      return (
        <View style={styles.container}>
          {renderLabel()}
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value || ''}
            onChangeText={handleChange}
            placeholder={category.description || `Enter ${category.name}`}
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
          <TextInput
            style={[styles.textArea, error && styles.inputError]}
            value={value || ''}
            onChangeText={handleChange}
            placeholder={category.description || `Enter ${category.name}`}
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={validationRules.maxLength}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      );

    case 'number':
      return (
        <View style={styles.container}>
          {renderLabel()}
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value?.toString() || ''}
            onChangeText={(text) => {
              const num = parseFloat(text);
              handleChange(isNaN(num) ? null : num);
            }}
            placeholder={category.description || `Enter ${category.name}`}
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
              {value ? new Date(value).toLocaleString() : `Select ${category.name}`}
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
              {category.name} {required && <Text style={styles.required}>*</Text>}
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
        .map(v => ({ id: v.id, name: v.name }));

      return (
        <View style={styles.container}>
          {renderLabel()}
          <TouchableOpacity
            style={[styles.dropdown, error && styles.inputError]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
              {selectOptions.find(opt => opt.id === value)?.name || `Select ${category.name}`}
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
                  <Text style={styles.modalTitle}>{category.name}</Text>
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
        .map(v => ({ id: v.id, name: v.name }));

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
                : `Select ${category.name}`}
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
                  <Text style={styles.modalTitle}>{category.name}</Text>
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
  errorText: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: 4,
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
