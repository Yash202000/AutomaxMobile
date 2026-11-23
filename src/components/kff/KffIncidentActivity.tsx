import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiBaseURL } from '@/src/api/client';
import { AuthenticatedImageViewer } from '@/src/components/AuthenticatedImageViewer';
import { downloadAndOpenAttachment } from '@/src/utils/attachmentDownload';

import KffBottomSheet from './KffBottomSheet';
import { formatKffDateTime } from './kffDateUtils';
import { kffPersonName } from './kffIncidentMapper';
import { KFF_COLORS, KFF_SHADOWS } from './kffTheme';

// Attachments and comments from the KFF incident detail response
// (`attachments` / `comments` on GET /incidents/{id}). Files are fetched from
// the device's configured server (getApiBaseURL) with the session token.

const THUMB_SIZE = 92;
// Shown inline (horizontal strip); more than this opens the full grid dialog.
const MAX_INLINE_ATTACHMENTS = 10;
const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_PADDING = 20;

const isImage = (att: any) => String(att?.mime_type ?? '').startsWith('image/');

const fileIcon = (mime = ''): React.ComponentProps<typeof Ionicons>['name'] => {
  if (mime.startsWith('audio/')) return 'musical-notes-outline';
  if (mime.startsWith('video/')) return 'videocam-outline';
  if (mime.includes('pdf')) return 'document-text-outline';
  return 'document-outline';
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const previewUri = (id: string) => `${getApiBaseURL()}/attachments/${id}/preview`;

const useAuthToken = () => {
  const [token, setToken] = useState('');
  useEffect(() => {
    SecureStore.getItemAsync('authToken')
      .then((value) => setToken(value || ''))
      .catch(() => {});
  }, []);
  return token;
};

/** One attachment square: image thumbnail, or file icon + name. */
const AttachmentTile = ({
  att,
  size,
  token,
  onPress,
}: {
  att: any;
  size: number;
  token: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.thumb, { width: size, height: size }]}
    activeOpacity={0.85}
    onPress={onPress}
    accessibilityLabel={att.file_name}
  >
    {isImage(att) ? (
      !!token && (
        <Image
          source={{ uri: previewUri(att.id), headers: { Authorization: `Bearer ${token}` } }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      )
    ) : (
      <View style={styles.fileTile}>
        <Ionicons name={fileIcon(att.mime_type)} size={28} color={KFF_COLORS.primary} />
        <Text style={styles.fileTileName} numberOfLines={2}>
          {att.file_name}
        </Text>
        {!!att.file_size && <Text style={styles.fileTileSize}>{formatSize(att.file_size)}</Text>}
      </View>
    )}
  </TouchableOpacity>
);

export const KffAttachmentsCard = ({ attachments }: { attachments?: any[] }) => {
  const { t, i18n } = useTranslation();
  const token = useAuthToken();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [gridVisible, setGridVisible] = useState(false);

  const items = (attachments ?? []).filter((att) => att?.id);
  if (items.length === 0) return null;
  const images = items.filter(isImage);
  const inline = items.slice(0, MAX_INLINE_ATTACHMENTS);
  const hiddenCount = items.length - inline.length;
  const gridTileSize =
    (windowWidth - 2 * GRID_PADDING - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;

  // Images open the zoomable viewer; other files download / open.
  const openAttachment = (att: any) => {
    if (isImage(att)) setViewerIndex(images.indexOf(att));
    else downloadAndOpenAttachment(att.id, att.file_name, att.mime_type);
  };

  // Rendered inside the grid dialog while it's open so it stacks above it.
  const viewer = (
    <AuthenticatedImageViewer
      images={images.map((att) => ({
        id: att.id,
        uri: previewUri(att.id),
        file_name: att.file_name,
        meta: { uploadedAt: formatKffDateTime(att.created_at, i18n.language) },
      }))}
      imageIndex={viewerIndex ?? 0}
      visible={viewerIndex !== null}
      onRequestClose={() => setViewerIndex(null)}
      token={token}
    />
  );

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.cardTitle}>{t('kff.detail.attachments')}</Text>
        <Text style={styles.countPill}>{items.length}</Text>
      </View>

      {/* One row; swipe sideways for more */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {inline.map((att) => (
          <AttachmentTile
            key={att.id}
            att={att}
            size={THUMB_SIZE}
            token={token}
            onPress={() => openAttachment(att)}
          />
        ))}
        {hiddenCount > 0 && (
          <TouchableOpacity
            style={[styles.thumb, styles.moreTile]}
            activeOpacity={0.85}
            onPress={() => setGridVisible(true)}
            accessibilityLabel={t('common.viewAll')}
          >
            <Ionicons name="grid-outline" size={24} color={KFF_COLORS.primary} />
            <Text style={styles.moreText}>+{hiddenCount}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {!gridVisible && viewer}

      {/* All attachments as a grid */}
      <Modal visible={gridVisible} animationType="slide" onRequestClose={() => setGridVisible(false)}>
        <View style={[styles.gridScreen, { paddingTop: insets.top }]}>
          <View style={styles.gridHeader}>
            <Text style={styles.gridTitle}>
              {t('kff.detail.attachments')} ({items.length})
            </Text>
            <TouchableOpacity
              style={styles.gridClose}
              onPress={() => setGridVisible(false)}
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={24} color={KFF_COLORS.navy} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(att) => String(att.id)}
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 20 }]}
            renderItem={({ item }) => (
              <AttachmentTile
                att={item}
                size={gridTileSize}
                token={token}
                onPress={() => openAttachment(item)}
              />
            )}
          />
          {gridVisible && viewer}
        </View>
      </Modal>
    </View>
  );
};

// Only the latest comment(s) show on the card; the rest open in a dialog.
const MAX_INLINE_COMMENTS = 1;

/** The comment itself first; who / when below in small text. */
const CommentItem = ({ comment, divider }: { comment: any; divider: boolean }) => {
  const { t, i18n } = useTranslation();
  const author = kffPersonName(comment.author) || t('common.na');
  return (
    <View style={[styles.comment, divider && styles.commentDivider]}>
      <Text style={styles.commentText} selectable>
        {comment.content}
      </Text>
      <View style={styles.commentMeta}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{author.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
        <Text style={styles.meta}>•</Text>
        <Text style={styles.meta}>{formatKffDateTime(comment.created_at, i18n.language)}</Text>
        {comment.is_internal && <Text style={styles.internalTag}>{t('kff.detail.internal')}</Text>}
      </View>
    </View>
  );
};

export const KffCommentsCard = ({ comments }: { comments?: any[] }) => {
  const { t } = useTranslation();
  const [sheetVisible, setSheetVisible] = useState(false);

  const items = (comments ?? [])
    .filter((c) => c?.id && c?.content)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (items.length === 0) return null;
  const inline = items.slice(0, MAX_INLINE_COMMENTS);
  const hiddenCount = items.length - inline.length;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.cardTitle}>{t('kff.detail.comments')}</Text>
        <Text style={styles.countPill}>{items.length}</Text>
        {hiddenCount > 0 && (
          <TouchableOpacity
            style={styles.viewAll}
            activeOpacity={0.8}
            onPress={() => setSheetVisible(true)}
            hitSlop={8}
          >
            <Text style={styles.viewAllText}>{t('common.viewAll')}</Text>
            <Ionicons name="chevron-forward" size={13} color={KFF_COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {inline.map((comment, index) => (
        <CommentItem key={comment.id} comment={comment} divider={index > 0} />
      ))}

      {/* All comments: half-screen bottom sheet, drag up for full screen */}
      <KffBottomSheet
        visible={sheetVisible}
        title={`${t('kff.detail.comments')} (${items.length})`}
        onClose={() => setSheetVisible(false)}
      >
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          {items.map((comment, index) => (
            <CommentItem key={comment.id} comment={comment} divider={index > 0} />
          ))}
        </ScrollView>
      </KffBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: KFF_COLORS.white,
    borderRadius: 22,
    padding: 18,
    ...KFF_SHADOWS.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: KFF_COLORS.navy,
    textAlign: 'left',
  },
  countPill: {
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: KFF_COLORS.primarySoft,
    color: KFF_COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  strip: {
    gap: GRID_GAP,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: KFF_COLORS.primarySoft,
  },
  fileTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 4,
  },
  fileTileName: {
    fontSize: 11,
    fontWeight: '600',
    color: KFF_COLORS.text,
    textAlign: 'center',
  },
  fileTileSize: {
    fontSize: 10,
    color: KFF_COLORS.textMuted,
  },
  moreTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: KFF_COLORS.primaryRing,
  },
  moreText: {
    fontSize: 16,
    fontWeight: '800',
    color: KFF_COLORS.primary,
  },
  gridScreen: {
    flex: 1,
    backgroundColor: KFF_COLORS.background,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID_PADDING,
    paddingVertical: 14,
  },
  gridTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: KFF_COLORS.navy,
  },
  gridClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: KFF_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...KFF_SHADOWS.card,
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
  },
  gridRow: {
    gap: GRID_GAP,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginStart: 'auto',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: KFF_COLORS.primary,
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  meta: {
    fontSize: 12,
    color: KFF_COLORS.textMuted,
    textAlign: 'left',
  },
  comment: {
    paddingVertical: 10,
  },
  commentDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: KFF_COLORS.divider,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 21,
    color: KFF_COLORS.text,
    textAlign: 'left',
  },
  commentMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: KFF_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: KFF_COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  author: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: KFF_COLORS.textSecondary,
  },
  internalTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FDF1DC',
    color: '#B7791F',
    fontSize: 10,
    fontWeight: '700',
  },
});
