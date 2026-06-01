import { useState, useEffect } from 'react';
import { getClassificationsTree } from '@/src/api/classifications';
import { getDepartmentsTree } from '@/src/api/departments';
import { getLocationsTree } from '@/src/api/locations';
import { TreeNode } from '@/src/components/TreeSelect';

export const useHierarchy = () => {
  const [classTree, setClassTree] = useState<TreeNode[]>([]);
  const [deptTree, setDeptTree] = useState<TreeNode[]>([]);
  const [locTree, setLocTree] = useState<TreeNode[]>([]);

  useEffect(() => {
    let active = true;

    const fetchTrees = async () => {
      try {
        const [classRes, deptRes, locRes] = await Promise.all([
          getClassificationsTree().catch(err => {
            console.error('Error fetching classification tree:', err);
            return { success: false, data: [] };
          }),
          getDepartmentsTree().catch(err => {
            console.error('Error fetching department tree:', err);
            return { success: false, data: [] };
          }),
          getLocationsTree().catch(err => {
            console.error('Error fetching location tree:', err);
            return { success: false, data: [] };
          }),
        ]);

        if (active) {
          if (classRes.success && classRes.data) {
            setClassTree(classRes.data);
          }
          if (deptRes.success && deptRes.data) {
            setDeptTree(deptRes.data);
          }
          if (locRes.success && locRes.data) {
            setLocTree(locRes.data);
          }
        }
      } catch (err) {
        console.error('Error in useHierarchy trees fetching:', err);
      }
    };

    fetchTrees();

    return () => {
      active = false;
    };
  }, []);

  const getPath = (tree: TreeNode[], targetId?: string): string => {
    if (!tree || tree.length === 0 || !targetId) return '';

    const findPath = (nodes: TreeNode[], id: string, currentPath: string[] = []): string[] | null => {
      for (const node of nodes) {
        if (node && String(node.id) === String(id)) {
          return [...currentPath, node.name];
        }
        if (node && node.children && node.children.length > 0) {
          const found = findPath(node.children, id, [...currentPath, node.name]);
          if (found) return found;
        }
      }
      return null;
    };

    const pathNames = findPath(tree, targetId);
    return pathNames ? pathNames.join(' > ') : '';
  };

  return {
    classTree,
    deptTree,
    locTree,
    getPath,
  };
};
