import { getNotifications } from "@/src/api/notifications";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    ImageBackground,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Notification {
    id: string;
    subject: string;
    body: string;
    status: string;
    channel: string;
    created_at: string;
    sent_at?: string;
    metadata?: any;
}

interface PaginationInfo {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
}

const NotificationCard = ({ notification }: { notification: Notification }) => {
    const { t } = useTranslation();

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case "failed":
            case "error":
                return "#E74C3C";
            case "success":
            case "sent":
            case "delivered":
                return "#2ECC71";
            case "pending":
            case "queued":
                return "#F1C40F";
            default:
                return "#95A5A6";
        }
    };

    const getChannelIcon = (channel: string) => {
        switch (channel.toLowerCase()) {
            case "push-notification":
            case "push":
                return "notifications-outline";
            case "sms":
                return "chatbubble-outline";
            case "email":
                return "mail-outline";
            default:
                return "information-circle-outline";
        }
    };

    return (
        <View style={styles.card}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(notification.status) }]} />
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <View style={styles.channelRow}>
                        <Ionicons name={getChannelIcon(notification.channel) as any} size={14} color="#666" />
                        <Text style={styles.channelText}>
                            {t(`notifications.channel.${notification.channel.split('-')[0]}` || notification.channel)}
                        </Text>
                    </View>
                    <Text style={styles.dateText}>
                        {new Date(notification.created_at).toLocaleString()}
                    </Text>
                </View>
                <Text style={styles.title} numberOfLines={1}>{notification.subject}</Text>
                <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>

                {(notification.status.toLowerCase() === "failed" || notification.status.toLowerCase() === "error") && (
                    <View style={styles.failedBadge}>
                        <Ionicons name="alert-circle" size={12} color="#E74C3C" />
                        <Text style={styles.failedText}>{t("notifications.status.failed")}</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const NotificationsScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        limit: 20,
        total_items: 0,
        total_pages: 0,
    });

    const isLoadingMore = useRef(false);

    const fetchNotifications = useCallback(async (page = 1, append = false) => {
        if (page === 1 && !refreshing) {
            setLoading(true);
        }
        setError("");

        // You can add more filters here if needed
        const response = await getNotifications({ page, limit: 20 });

        if (response.success) {
            if (append) {
                setNotifications((prev) => [...prev, ...response.data]);
            } else {
                setNotifications(response.data);
            }
            setPagination(response.pagination);
        } else {
            setError(response.error || t("notifications.failedToFetch"));
        }

        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        isLoadingMore.current = false;
    }, [refreshing, t]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchNotifications(1, false);
    };

    const handleLoadMore = () => {
        if (isLoadingMore.current || loadingMore || loading || refreshing) return;
        if (pagination.page >= pagination.total_pages) return;

        isLoadingMore.current = true;
        setLoadingMore(true);
        fetchNotifications(pagination.page + 1, true);
    };

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#1A237E" />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                    <Ionicons name="notifications-off-outline" size={64} color="#CCC" />
                </View>
                <Text style={styles.emptyTitle}>{t("notifications.noNotifications")}</Text>
                <Text style={styles.emptySubtitle}>{t("notifications.noNotificationsDesc")}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ImageBackground
                source={require("@/assets/images/background.png")}
                style={styles.header}
            >
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t("notifications.title")}</Text>
                <View style={{ width: 24 }} />
            </ImageBackground>

            <View style={styles.content}>
                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#1A237E" />
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications(1)}>
                            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        renderItem={({ item }) => <NotificationCard notification={item} />}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.3}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#1A237E"]} />
                        }
                        ListEmptyComponent={renderEmpty}
                        ListFooterComponent={renderFooter}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1A237E",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 8,
    },
    headerTitle: {
        color: "white",
        fontSize: 20,
        fontWeight: "bold",
    },
    content: {
        flex: 1,
        backgroundColor: "#F5F5F5",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -10,
        overflow: "hidden",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    errorText: {
        color: "#E74C3C",
        fontSize: 16,
        textAlign: "center",
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: "#1A237E",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: "white",
        fontWeight: "600",
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
        flexGrow: 1,
    },
    card: {
        backgroundColor: "white",
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: "row",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statusIndicator: {
        width: 6,
    },
    cardContent: {
        flex: 1,
        padding: 16,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    channelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    channelText: {
        fontSize: 12,
        color: "#666",
        fontWeight: "500",
    },
    dateText: {
        fontSize: 11,
        color: "#999",
    },
    title: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 4,
    },
    body: {
        fontSize: 14,
        color: "#666",
        lineHeight: 18,
    },
    failedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 8,
        backgroundColor: "#FDEDEC",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: "flex-start",
    },
    failedText: {
        fontSize: 11,
        color: "#E74C3C",
        fontWeight: "bold",
    },
    footerLoader: {
        paddingVertical: 20,
        alignItems: "center",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 100,
    },
    emptyIconContainer: {
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: "#999",
        textAlign: "center",
    },
});

export default NotificationsScreen;
