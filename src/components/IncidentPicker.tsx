import { Ionicons } from "@expo/vector-icons";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { getIncidents } from "../api/incidents";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const IncidentPicker = ({
    incidentDropdownOpen,
    onClose,
    selectedSourceIncident,
    onSelect,
}: {
    incidentDropdownOpen: boolean;
    onClose: (value: boolean) => void;
    selectedSourceIncident: any;
    onSelect: (value: any) => void;
}) => {
    const { t } = useTranslation();

    const [incidents, setIncidents] = useState<any[]>([]);
    const [incidentSearch, setIncidentSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const { user } = useAuth()

    // Debounce ref so we can cancel pending searches
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track the last search term that was actually fetched to avoid stale responses
    const fetchedSearch = useRef('');

    // ── Core fetcher ────────────────────────────────────────────────────────────
    const fetchPage = useCallback(async (searchTerm: string, pageNum: number) => {
        const isFirstPage = pageNum === 1;
        if (isFirstPage) setLoading(true);
        else setLoadingMore(true);

        try {
            const today = new Date();
            today.setUTCHours(23, 59, 59, 999);

            const last3Months = new Date(today);
            last3Months.setUTCDate(last3Months.getUTCDate() - 90);
            last3Months.setUTCHours(0, 0, 0, 0);

            const params: Record<string, any> = {
                reporter_id: user?.id,
                limit: PAGE_SIZE,
                page: pageNum,
                start_date: last3Months.toISOString(),
                end_date: today.toISOString(),
            };
            if (searchTerm.trim()) {
                params.search = searchTerm.trim();
            }

            const response = await getIncidents(params);
            // Discard stale responses (user may have typed again)
            if (fetchedSearch.current !== searchTerm) return;

            if (response.success && response.data) {
                const mapped = response.data.map((i: any) => ({
                    id: i.id,
                    name: `${i.incident_number} - ${i.title}`,
                }));

                setIncidents(prev => isFirstPage ? mapped : [...prev, ...mapped]);
                setTotalPages(response.pagination?.total_pages ?? 1);
                setPage(pageNum);
            }
        } catch (error) {
            console.error('[IncidentPicker] fetch error:', error);
        } finally {
            if (isFirstPage) setLoading(false);
            else setLoadingMore(false);
        }
    }, []);

    // ── Reset + initial load when modal opens ───────────────────────────────────
    useEffect(() => {
        if (!incidentDropdownOpen) return;
        setIncidents([]);
        setPage(1);
        setTotalPages(1);
        setIncidentSearch('');
        fetchedSearch.current = '';
        fetchPage('', 1);
    }, [incidentDropdownOpen, fetchPage]);

    // ── Debounced search ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!incidentDropdownOpen) return;

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            fetchedSearch.current = incidentSearch;
            setIncidents([]);
            setPage(1);
            setTotalPages(1);
            fetchPage(incidentSearch, 1);
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [incidentSearch, incidentDropdownOpen, fetchPage]);

    // ── Infinite scroll ──────────────────────────────────────────────────────────
    const handleEndReached = useCallback(() => {
        if (loadingMore || loading) return;
        const nextPage = page + 1;
        if (nextPage > totalPages) return;
        fetchedSearch.current = incidentSearch;
        fetchPage(incidentSearch, nextPage);
    }, [loadingMore, loading, page, totalPages, incidentSearch, fetchPage]);

    // ── Footer: spinner while loading more ───────────────────────────────────────
    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#E74C3C" />
            </View>
        );
    };

    return (
        <Modal
            visible={incidentDropdownOpen}
            transparent
            animationType="slide"
            onRequestClose={() => onClose(false)}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => onClose(false)}
            >
                <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {t('addComplaint.selectSourceIncident')}
                        </Text>
                        <TouchableOpacity onPress={() => onClose(false)}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    {/* Search bar */}
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
                        <TextInput
                            style={[styles.searchInput, { textAlign: i18n.language === 'ar' ? 'right' : 'left' }]}
                            placeholder={t('common.searchByIncidentNumOrTitle', 'Search by number or title…')}
                            value={incidentSearch}
                            onChangeText={setIncidentSearch}
                            placeholderTextColor="#999"
                            autoFocus
                        />
                        {incidentSearch.length > 0 && (
                            <TouchableOpacity onPress={() => setIncidentSearch('')}>
                                <Ionicons name="close-circle" size={18} color="#999" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Results */}
                    {loading ? (
                        <View style={styles.centeredLoader}>
                            <ActivityIndicator size="large" color="#E74C3C" />
                        </View>
                    ) : incidents.length === 0 ? (
                        <View style={styles.emptyList}>
                            <Text style={styles.emptyText}>
                                {incidentSearch.trim()
                                    ? t('addComplaint.noIncidentsFound', 'No incidents match your search')
                                    : t('addComplaint.noIncidentsCreated', 'You have no incidents yet')}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={incidents}
                            keyExtractor={(item) => item.id}
                            keyboardShouldPersistTaps="handled"
                            onEndReached={handleEndReached}
                            onEndReachedThreshold={0.3}
                            ListFooterComponent={renderFooter}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.optionItem}
                                    onPress={() => {
                                        onSelect(item);
                                        onClose(false);
                                        setIncidentSearch('');
                                    }}
                                >
                                    <Text style={styles.optionText}>{item.name}</Text>
                                    {selectedSourceIncident?.id === item.id && (
                                        <Ionicons name="checkmark" size={20} color="#E74C3C" />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        width: '90%',
        height: '80%',
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
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 8,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    optionText: {
        fontSize: 16,
        flex: 1,
        marginRight: 8,
    },
    centeredLoader: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    footerLoader: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    emptyList: {
        padding: 24,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
});

export default IncidentPicker;