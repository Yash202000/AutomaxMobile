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
  Modal,
  Pressable,
} from 'react-native';
import { getIncidents } from '@/src/api/incidents';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

// ─── regex patterns ───────────────────────────────────────────────────────────
// Full storage tag:  @[INC-1234](incident:uuid)
const STORAGE_MENTION_RE = /@\[([^\]]+)\]\(incident:([^)]+)\)/g;
// Display token inserted into TextInput:  @INC-1234
// We use a zero-width no-break space (U+FEFF) as a sentinel after the token
// so the user can type next to it without colliding with the mention text.
const DISPLAY_SEPARATOR = '\uFEFF'; // zero-width no-break space

// ─── helpers ─────────────────────────────────────────────────────────────────
/**
 * Convert the DB/storage value (with @[INC-number](incident:uuid) tags) into
 * the display string shown in the TextInput (@INC-number tokens).
 * A map of {displayToken → storageTag} is built so we can reconstruct the
 * storage value when the user edits.
 */
const storageToDisplay = (raw: string): string => {
  if (!raw) return '';
  return raw.replace(STORAGE_MENTION_RE, (_m, num) => `@${num}${DISPLAY_SEPARATOR}`);
};

/**
 * Convert the display string back to the storage format.
 * We re-derive the full tag by looking up the incident number in the raw value
 * (the parent always holds the authoritative raw value).
 * Strategy: for each @<token> in the display string, find the matching
 * @[<token>](incident:...) in the raw string and substitute.
 */
const displayToStorage = (display: string, raw: string): string => {
  // Build a map from incident_number → full storage tag, from current raw
  const tagMap = new Map<string, string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(STORAGE_MENTION_RE.source, 'g');
  while ((m = re.exec(raw)) !== null) {
    tagMap.set(m[1], m[0]); // m[1] = incident_number, m[0] = full tag
  }

  // Replace @<token><SEPARATOR> in display with the full storage tag
  return display.replace(
    new RegExp(`@([^\s${DISPLAY_SEPARATOR}@]+)${DISPLAY_SEPARATOR}`, 'g'),
    (_m, num) => tagMap.get(num) ?? `@${num}`,
  );
};

// ─── props ────────────────────────────────────────────────────────────────────
export interface IncidentMentionTextareaProps
  extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  /** Storage/DB value — contains @[INC-number](incident:uuid) tags */
  value: string;
  /** Called with the storage value (same format) whenever the content changes */
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
  /** Index of the '@' character in the DISPLAY string */
  triggerIndex: number;
}

// ─── component ────────────────────────────────────────────────────────────────
export const IncidentMentionTextarea: React.FC<IncidentMentionTextareaProps> = ({
  value,        // storage format (authoritative)
  onChangeText,
  placeholder,
  filters,
  containerStyle,
  style,
  ...textInputProps
}) => {
  const { t } = useTranslation();

  // ── display value state ─────────────────────────────────────────────────
  // The TextInput shows only the display form; the parent holds the storage form.
  const [displayValue, setDisplayValue] = useState(() => storageToDisplay(value));

  // Keep display in sync when the parent changes the value externally
  // (e.g. form reset) but NOT when we are the source of the change.
  const isInternalChange = useRef(false);
  useEffect(() => {
    if (!isInternalChange.current) {
      setDisplayValue(storageToDisplay(value));
    }
    isInternalChange.current = false;
  }, [value]);

  // ── mention detection state ─────────────────────────────────────────────
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

  // ── dropdown position ───────────────────────────────────────────────────
  useEffect(() => {
    if (mention.isActive && containerRef.current) {
      const timer = setTimeout(() => {
        containerRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
          setDropdownPosition({ top: pageY + height + 4, left: pageX, width });
        });
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDropdownPosition(null);
    }
  }, [mention.isActive]);

  // ── incident search ─────────────────────────────────────────────────────
  const searchIncidents = useCallback(
    async (query: string) => {
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
              (inc: any) => !filters.currentIncident_ids?.includes(inc.id),
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
    },
    [filters],
  );

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (mention.isActive) {
      searchTimeout.current = setTimeout(() => searchIncidents(mention.searchText), 350);
    } else {
      setMatchingIncidents([]);
    }
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [mention.isActive, mention.searchText, searchIncidents]);

  // ── mention detection ───────────────────────────────────────────────────
  const checkMentionState = (text: string, cursorOffset: number) => {
    const safeOffset = Math.min(cursorOffset, text.length);
    const textBeforeCursor = text.substring(0, safeOffset);
    const match = textBeforeCursor.match(/(^|\s)@([^\s\uFEFF]*)$/);

    if (match) {
      const atIndex = safeOffset - match[2].length - 1;
      setMention({ isActive: true, searchText: match[2], triggerIndex: atIndex });
    } else {
      if (mention.isActive) {
        setMention({ isActive: false, searchText: '', triggerIndex: -1 });
      }
    }
  };

  // ── text change ─────────────────────────────────────────────────────────
  const handleTextChange = (newDisplay: string) => {
    setDisplayValue(newDisplay);

    // Re-derive storage value: convert display tokens back to full tags using
    // the current raw value as the tag map source.
    const newRaw = displayToStorage(newDisplay, value);

    isInternalChange.current = true;
    onChangeText(newRaw);

    // Check mention trigger at end of new text
    checkMentionState(newDisplay, newDisplay.length);
  };

  const handleSelectionChange = (e: any) => {
    const newSel = e.nativeEvent.selection;
    setSelection(newSel);
    checkMentionState(displayValue, newSel.end);
  };

  // ── incident selection ──────────────────────────────────────────────────
  const handleSelectIncident = (incident: any) => {
    const searchText = mention.searchText;
    const triggerPattern = `@${searchText}`;

    // Locate the trigger in the display string (robustly, handles state lag)
    let startIdx = mention.triggerIndex;
    if (
      startIdx < 0 ||
      displayValue.substring(startIdx, startIdx + triggerPattern.length) !== triggerPattern
    ) {
      startIdx = displayValue.lastIndexOf(triggerPattern);
    }
    if (startIdx < 0) return;

    const endIdx = startIdx + triggerPattern.length;
    const before = displayValue.substring(0, startIdx);
    const after = displayValue.substring(endIdx);

    // Display token: @INC-number + sentinel separator
    const prefixSpace = startIdx > 0 && displayValue[startIdx - 1] !== ' ' ? ' ' : '';
    const displayToken = `${prefixSpace}@${incident.incident_number}${DISPLAY_SEPARATOR} `;
    const newDisplay = before + displayToken + after;

    // Storage tag: @[INC-number](incident:uuid)
    const storageTag = `${prefixSpace}@[${incident.incident_number}](incident:${incident.id}) `;
    // Rebuild raw: replace the trigger region in the current raw value
    // The raw value mirrors the display, so find the same trigger in raw
    const rawTrigger = `@${searchText}`;
    let rawStart = value.lastIndexOf(rawTrigger);
    // Simple guard: if raw doesn't contain the plain trigger, just append
    let newRaw: string;
    if (rawStart < 0) {
      newRaw = value.trimEnd() + ' ' + storageTag.trim() + ' ';
    } else {
      const rawBefore = value.substring(0, rawStart);
      const rawAfter = value.substring(rawStart + rawTrigger.length);
      newRaw = rawBefore + storageTag + rawAfter;
    }

    setDisplayValue(newDisplay);
    setMention({ isActive: false, searchText: '', triggerIndex: -1 });
    isInternalChange.current = true;
    onChangeText(newRaw);
  };

  // ── render the display value with styled mention chips ──────────────────
  /**
   * Renders the displayValue as inline <Text> elements:
   *   - plain text → normal colour
   *   - @INC-number<SEPARATOR> → teal bold chip
   * This is used as the TextInput's `renderTextComponent` replacement approach
   * — but since RN TextInput can't do inline styling, we render a styled
   * read-only Text BELOW the TextInput as a preview when mentions are present.
   *
   * The TextInput itself shows displayValue (which looks like "@INC-number " —
   * already human-readable), and the chip styling is shown as a readonly
   * preview chip strip below the input when editing is not active.
   *
   * NOTE: React Native's TextInput cannot render inline rich text.
   * The display string "@INC-2026-09934 " is already readable without styling;
   * we additionally show a chip preview strip beneath the input.
   */
  const renderMentionChips = () => {
    const chips: { id: string; number: string }[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(STORAGE_MENTION_RE.source, 'g');
    while ((m = re.exec(value)) !== null) {
      chips.push({ id: m[2], number: m[1] });
    }
    if (chips.length === 0) return null;

    return (
      <View style={styles.chipStrip}>
        {chips.map((chip) => (
          <View key={chip.id} style={styles.chip}>
            <Ionicons name="link-outline" size={11} color="#2EC4B6" />
            <Text style={styles.chipText}>{chip.number}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ── jsx ─────────────────────────────────────────────────────────────────
  return (
    <View ref={containerRef} style={[styles.container, containerStyle]}>
      {/* Main text input — shows the human-readable display value */}
      <TextInput
        style={[styles.textInput, style]}
        value={displayValue}
        onChangeText={handleTextChange}
        onSelectionChange={handleSelectionChange}
        placeholder={
          placeholder ||
          t('common.tagIncidentPlaceholder', 'Type @ to tag an incident...')
        }
        placeholderTextColor="#999"
        multiline
        {...textInputProps}
      />

      {/* Chip strip — shows tagged incidents as teal badges beneath the input */}
      {renderMentionChips()}

      {/* Incident suggestion dropdown */}
      {mention.isActive && dropdownPosition && (
        <Modal
          transparent
          visible={mention.isActive}
          animationType="none"
          onRequestClose={() => setMention((p) => ({ ...p, isActive: false }))}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMention((p) => ({ ...p, isActive: false }))}
          >
            <View
              style={[
                styles.dropdownContainer,
                {
                  position: 'absolute',
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              {/* Header */}
              <View style={styles.dropdownHeader}>
                <Ionicons name="at-circle-outline" size={16} color="#2EC4B6" />
                <Text style={styles.dropdownTitle}>
                  {t('common.tagIncident', 'Tag Incident')}
                </Text>
                {loading && (
                  <ActivityIndicator size="small" color="#2EC4B6" style={{ marginLeft: 8 }} />
                )}
              </View>

              {/* Results */}
              {matchingIncidents.length > 0 ? (
                <FlatList
                  data={matchingIncidents}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="always"
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 200 }}
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

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    width: '100%',
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
  // ── chip strip ──────────────────────────────────────────────────────────
  chipStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8FAF8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2EC4B640',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2EC4B6',
  },
  // ── dropdown ────────────────────────────────────────────────────────────
  dropdownContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  dropdownTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  optionNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2EC4B6',
    width: 120,
  },
  optionTitle: {
    fontSize: 13,
    color: '#555',
    flex: 1,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#aaa',
  },
});
