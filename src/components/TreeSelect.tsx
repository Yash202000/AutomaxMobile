import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { t } from 'i18next';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface TreeNode {
  id: string;
  name: string;
  type?: string;
  children?: TreeNode[];
  parent_id?: string | null;
}

interface TreeSelectProps {
  label: string;
  value: string;
  data: TreeNode[];
  onSelect: (node: TreeNode | null) => void;
  loading?: boolean;
  required?: boolean;
  error?: string;
  leafOnly?: boolean;
  placeholder?: string;
  iconType?: 'classification' | 'location' | 'default';
  // Multi-select props
  multiSelect?: boolean;
  selectedIds?: string[];
  onMultiSelect?: (nodes: TreeNode[]) => void;
}

interface TreeItemProps {
  node: TreeNode;
  level: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNode) => void;
  leafOnly: boolean;
  selectedId?: string;
  // Multi-select
  multiSelect?: boolean;
  selectedIds?: Set<string>;
  iconType?: 'classification' | 'location' | 'default';
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  level,
  expandedIds,
  onToggle,
  onSelect,
  leafOnly,
  selectedId,
  multiSelect,
  selectedIds,
  iconType = 'default',
}) => {
  if (!node || !node.id || !node.name) return null;

  const hasChildren = node.children && Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isLeaf = !hasChildren;
  const canSelect = leafOnly ? isLeaf : true;
  const isSelected = multiSelect ? (selectedIds?.has(node.id) ?? false) : selectedId === node.id;

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.treeItem,
          { paddingLeft: 16 + level * 20 },
          isSelected && styles.treeItemSelected,
        ]}
        onPress={() => {
          if (hasChildren) onToggle(node.id);
          if (canSelect) onSelect(node);
        }}
        activeOpacity={canSelect ? 0.7 : 1}
      >
        <View style={styles.treeItemContent}>
          {hasChildren ? (
            <TouchableOpacity onPress={() => onToggle(node.id)} style={styles.expandButton}>
              <Ionicons
                name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color="#666"
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.leafIndent} />
          )}
          <Ionicons
            name={
              iconType === 'classification'
                ? (hasChildren ? 'layers' : 'alert-circle')
                : iconType === 'location'
                  ? (hasChildren ? 'map' : 'location')
                  : (hasChildren ? 'folder' : 'document')
            }
            size={18}
            color={
              iconType === 'classification'
                ? (hasChildren ? '#8B5CF6' : '#EC4899')
                : iconType === 'location'
                  ? (hasChildren ? '#10B981' : '#3B82F6')
                  : (hasChildren ? '#F39C12' : '#3498DB')
            }
            style={styles.nodeIcon}
          />
          <Text
            style={[
              styles.treeItemText,
              !canSelect && styles.treeItemTextDisabled,
              isSelected && styles.treeItemTextSelected,
            ]}
            numberOfLines={1}
          >
            {node.name}
          </Text>
        </View>
        {multiSelect && canSelect ? (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
          </View>
        ) : (
          !multiSelect && isSelected && (
            <Ionicons name="checkmark-circle" size={20} color="#2EC4B6" />
          )
        )}
      </TouchableOpacity>

      {hasChildren && isExpanded && (
        <View>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              leafOnly={leafOnly}
              selectedId={selectedId}
              multiSelect={multiSelect}
              selectedIds={selectedIds}
              iconType={iconType}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const TreeSelect: React.FC<TreeSelectProps> = ({
  label,
  value,
  data,
  onSelect,
  loading,
  required,
  error,
  leafOnly = true,
  placeholder,
  iconType = 'default',
  multiSelect = false,
  selectedIds: selectedIdsProp = [],
  onMultiSelect,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | undefined>();
  // Multi-select internal state (pending until Done is pressed)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Find node by name (single select)
  const findNodeByName = useCallback(
    (nodes: TreeNode[], name: string): TreeNode | null => {
      if (!name) return null;
      for (const node of nodes) {
        if (node?.name && node.name === name) return node;
        if (node?.children && Array.isArray(node.children)) {
          const found = findNodeByName(node.children, name);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  // Find node by id
  const findNodeById = useCallback(
    (nodes: TreeNode[], id: string): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNodeById(node.children, id);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  // Sync single-select selectedId from value
  React.useEffect(() => {
    if (!multiSelect) {
      if (value && data.length > 0) {
        const node = findNodeByName(data, value);
        if (node) {
          setSelectedId(node.id);
          expandParents(node.id);
        }
      } else {
        setSelectedId(undefined);
      }
    }
  }, [value, data, findNodeByName, multiSelect]);

  // Sync multi-select pending from prop when modal opens
  const handleOpen = useCallback(() => {
    if (multiSelect) {
      setPendingIds(new Set(selectedIdsProp));
    }
    setModalVisible(true);
  }, [multiSelect, selectedIdsProp]);

  const findParentPath = useCallback(
    (nodes: TreeNode[], targetId: string, path: string[] = []): string[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) return path;
        if (node.children) {
          const result = findParentPath(node.children, targetId, [...path, node.id]);
          if (result) return result;
        }
      }
      return null;
    },
    []
  );

  const expandParents = useCallback(
    (nodeId: string) => {
      const path = findParentPath(data, nodeId);
      if (path) {
        setExpandedIds((prev) => {
          const newSet = new Set(prev);
          path.forEach((id) => newSet.add(id));
          return newSet;
        });
      }
    },
    [data, findParentPath]
  );

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const handleSelect = useCallback(
    (node: TreeNode) => {
      const hasChildren = node.children && node.children.length > 0;
      const isLeaf = !hasChildren;
      const canSelect = leafOnly ? isLeaf : true;
      if (!canSelect) return;

      if (multiSelect) {
        setPendingIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(node.id)) newSet.delete(node.id);
          else newSet.add(node.id);
          return newSet;
        });
      } else {
        setSelectedId(node.id);
        onSelect(node);
        setModalVisible(false);
      }
    },
    [leafOnly, onSelect, multiSelect]
  );

  const handleClear = useCallback(() => {
    if (multiSelect) {
      setPendingIds(new Set());
    } else {
      setSelectedId(undefined);
      onSelect(null);
      setModalVisible(false);
    }
  }, [onSelect, multiSelect]);

  const handleDone = useCallback(() => {
    if (multiSelect && onMultiSelect) {
      const nodes = Array.from(pendingIds)
        .map((id) => findNodeById(data, id))
        .filter(Boolean) as TreeNode[];
      onMultiSelect(nodes);
    }
    setModalVisible(false);
  }, [multiSelect, onMultiSelect, pendingIds, data, findNodeById]);

  const expandAll = useCallback(() => {
    const getAllIds = (nodes: TreeNode[], depth = 0, maxDepth = 10): string[] => {
      let ids: string[] = [];
      if (!Array.isArray(nodes) || depth >= maxDepth) return ids;
      for (const node of nodes) {
        if (node && node.id && node.children && Array.isArray(node.children) && node.children.length > 0) {
          ids.push(node.id);
          if (depth < maxDepth - 1) ids = ids.concat(getAllIds(node.children, depth + 1, maxDepth));
        }
      }
      return ids;
    };
    const allIds = getAllIds(data);
    setExpandedIds(new Set(allIds.length > 500 ? allIds.slice(0, 500) : allIds));
  }, [data]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Display text for the trigger button
  const displayText = multiSelect
    ? selectedIdsProp.length === 0
      ? placeholder || label
      : selectedIdsProp.length === 1
        ? (findNodeById(data, selectedIdsProp[0])?.name || `1 selected`)
        : `${selectedIdsProp.length} selected`
    : value || placeholder || label;

  const hasValue = multiSelect ? selectedIdsProp.length > 0 : !!value;

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdown, error && styles.dropdownError]}
        onPress={handleOpen}
      >
        <Text style={[styles.dropdownText, !hasValue && styles.placeholderText]}>
          {displayText}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color="#666" />
        ) : (
          <FontAwesome name="chevron-down" size={16} color="#666" />
        )}
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
          onPress={() => multiSelect ? handleDone() : setModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {label}{multiSelect && pendingIds.size > 0 ? ` (${pendingIds.size})` : ''}
              </Text>
              {multiSelect ? (
                <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
                  <Text style={styles.doneButtonText}>{t('common.done')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              )}
            </View>

            {/* Toolbar */}
            <View style={styles.toolbar}>
              <TouchableOpacity style={styles.toolbarButton} onPress={expandAll}>
                <Ionicons name="expand" size={16} color="#666" />
                <Text style={styles.toolbarButtonText}>{t('common.expandAll')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarButton} onPress={collapseAll}>
                <Ionicons name="contract" size={16} color="#666" />
                <Text style={styles.toolbarButtonText}>{t('common.collapseAll')}</Text>
              </TouchableOpacity>
              {multiSelect && (pendingIds.size > 0 || (!multiSelect && !!value)) && (
                <TouchableOpacity style={styles.toolbarButton} onPress={handleClear}>
                  <Ionicons name="close-circle-outline" size={16} color="#E74C3C" />
                  <Text style={[styles.toolbarButtonText, { color: '#E74C3C' }]}>{t('common.clear')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Clear option (single select) */}
            {!multiSelect && value && (
              <TouchableOpacity style={styles.clearOption} onPress={handleClear}>
                <Text style={styles.clearOptionText}>{t('common.clearSelection')}</Text>
                <Ionicons name="close-circle" size={20} color="#E74C3C" />
              </TouchableOpacity>
            )}

            {/* Hint */}
            {leafOnly && (
              <View style={styles.hintContainer}>
                <Ionicons name="information-circle" size={16} color="#666" />
                <Text style={styles.hintText}>
                  {multiSelect
                    ? t('common.tapLeafToSelectMultiple')
                    : t('common.onlyItemWithoutChildren')}
                </Text>
              </View>
            )}

            {data.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>{t('common.noOption')}</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.treeList}
                contentContainerStyle={styles.treeListContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {data.map((item) => (
                  <TreeItem
                    key={String(item.id)}
                    node={item}
                    level={0}
                    expandedIds={expandedIds}
                    onToggle={handleToggle}
                    onSelect={handleSelect}
                    leafOnly={leafOnly}
                    selectedId={selectedId}
                    multiSelect={multiSelect}
                    selectedIds={pendingIds}
                    iconType={iconType}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dropdownError: {
    borderColor: '#E74C3C',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: -16,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  doneButton: {
    backgroundColor: '#2EC4B6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  doneButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  toolbar: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 10,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    gap: 4,
  },
  toolbarButtonText: {
    fontSize: 12,
    color: '#666',
  },
  clearOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFF5F5',
  },
  clearOptionText: {
    fontSize: 16,
    color: '#E74C3C',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8F9FA',
    gap: 6,
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  treeList: {
    flex: 1,
  },
  treeListContent: {
    paddingBottom: 30,
  },
  treeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  treeItemSelected: {
    backgroundColor: '#E8F8F7',
  },
  treeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expandButton: {
    padding: 4,
    marginRight: 4,
  },
  leafIndent: {
    width: 26,
  },
  nodeIcon: {
    marginRight: 8,
  },
  treeItemText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  treeItemTextDisabled: {
    color: '#999',
  },
  treeItemTextSelected: {
    color: '#2EC4B6',
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2EC4B6',
    borderColor: '#2EC4B6',
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
});

export default TreeSelect;
