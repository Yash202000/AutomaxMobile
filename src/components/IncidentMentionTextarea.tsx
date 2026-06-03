import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInputProps,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { getIncidents } from '@/src/api/incidents';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

export interface IncidentMentionTextareaProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  filters?: {
    classification_ids?: string[];
    location_ids?: string[];
    currentIncident_ids?: string[];
  };
  containerStyle?: any;
}

interface MentionState {
  isActive: boolean;
  searchText: string;
  triggerIndex: number;
}

export const IncidentMentionTextarea: React.FC<IncidentMentionTextareaProps> = ({
  value,
  onChangeText,
  placeholder,
  filters,
  containerStyle,
  style,
  ...textInputProps
}) => {
  const { t } = useTranslation();
  const [mention, setMention] = useState<MentionState>({
    isActive: false,
    searchText: '',
    triggerIndex: -1,
  });
  const [matchingIncidents, setMatchingIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const searchTimeout = useRef<any>(null);
  const containerRef = useRef<View>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Measure container position relative to screen dynamically
  useEffect(() => {
    if (mention.isActive && containerRef.current) {
      const timer = setTimeout(() => {
        containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
          setDropdownPosition({
            top: pageY + height + 4,
            left: pageX,
            width: width,
          });
        });
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDropdownPosition(null);
    }
  }, [mention.isActive]);

  // Fetch matching incidents
  const searchIncidents = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const response = await getIncidents({
        search: query,
        limit: 8,
        record_type: 'incident',
        classification_ids: filters?.classification_ids || [],
        location_ids: filters?.location_ids || [],
      });

      if (response.success && Array.isArray(response.data)) {
        let results = response.data;
        if (filters?.currentIncident_ids?.length) {
          results = results.filter(
            (inc: any) => !filters.currentIncident_ids?.includes(inc.id)
          );
        }
        setMatchingIncidents(results);
      } else {
        setMatchingIncidents([]);
      }
    } catch (error) {
      console.error('[IncidentMentionTextarea] Search error:', error);
      setMatchingIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced search when searchText changes
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (mention.isActive) {
      searchTimeout.current = setTimeout(() => {
        searchIncidents(mention.searchText);
      }, 350);
    } else {
      setMatchingIncidents([]);
    }

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [mention.isActive, mention.searchText, searchIncidents]);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    checkMentionState(text, selection.end);
  };

  const handleSelectionChange = (e: any) => {
    const newSelection = e.nativeEvent.selection;
    setSelection(newSelection);
    checkMentionState(value, newSelection.end);
  };

  const checkMentionState = (text: string, cursorOffset: number) => {
    if (cursorOffset === undefined) return;
    const textBeforeCursor = text.substring(0, cursorOffset);
    const match = textBeforeCursor.match(/(^|\s)@([^\s]*)$/);

    if (match) {
      setMention({
        isActive: true,
        searchText: match[2],
        triggerIndex: cursorOffset - match[2].length - 1,
      });
    } else {
      setMention({
        isActive: false,
        searchText: '',
        triggerIndex: -1,
      });
    }
  };

  const handleSelectIncident = (incident: any) => {
    // Determine the end index of the '@searchText' trigger string stably
    const triggerEndIndex = mention.triggerIndex + mention.searchText.length + 1;

    const beforeMention = value.substring(0, mention.triggerIndex);
    const afterMention = value.substring(triggerEndIndex);

    // Standard mention tag format used in database/web: @[INC-1002](incident:uuid)
    const prefixSpace = mention.triggerIndex > 0 && value[mention.triggerIndex - 1] !== ' ' ? ' ' : '';
    const mentionTag = `${prefixSpace}@[${incident.incident_number}](incident:${incident.id}) `;
    const newValue = beforeMention + mentionTag + afterMention;

    onChangeText(newValue);
    setMention({ isActive: false, searchText: '', triggerIndex: -1 });
  };

  return (
    <View ref={containerRef} style={[styles.container, containerStyle]}>
      <TextInput
        style={[styles.textInput, style]}
        value={value}
        onChangeText={handleTextChange}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder || t('common.tagIncidentPlaceholder', 'Type @ to tag an incident...')}
        placeholderTextColor="#999"
        multiline
        {...textInputProps}
      />

      {mention.isActive && dropdownPosition && (
        <Modal
          transparent={true}
          visible={mention.isActive}
          animationType="none"
          onRequestClose={() => setMention(prev => ({ ...prev, isActive: false }))}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMention(prev => ({ ...prev, isActive: false }))}
          >
            <View
              style={[
                styles.dropdownContainer,
                {
                  position: 'absolute',
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                }
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.dropdownHeader}>
                <Ionicons name="at-circle-outline" size={16} color="#2EC4B6" />
                <Text style={styles.dropdownTitle}>
                  {t('common.tagIncident', 'Tag Incident')}
                </Text>
                {loading && <ActivityIndicator size="small" color="#2EC4B6" style={{ marginLeft: 8 }} />}
              </View>

              {matchingIncidents.length > 0 ? (
                <FlatList
                  data={matchingIncidents}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="always"
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 180 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.dropdownOption}
                      onPress={() => handleSelectIncident(item)}
                    >
                      <Text style={styles.optionNumber}>{item.incident_number}</Text>
                      <Text style={styles.optionTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              ) : !loading ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {t('common.noMatchingIncidents', 'No matching incidents found')}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    zIndex: 10,
  },
  textInput: {
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
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 99,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    backgroundColor: '#fafafa',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  dropdownTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
  },
  optionNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2EC4B6',
    width: 90,
  },
  optionTitle: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#888',
  },
});
