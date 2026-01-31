import { useState, useCallback, useEffect } from 'react';
import { useProject, FileEntry } from '../../contexts';

export function useSidebarFiles() {
  const { state: projectState, listFiles, createFile, createFolder, deleteFile, renameFile } = useProject();

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, FileEntry[]>>(new Map());

  const loadFiles = useCallback(async (relativePath: string) => {
    const entries = await listFiles(relativePath);
    if (relativePath === '') {
      setFiles(entries);
    } else {
      setFolderContents((prev) => new Map(prev).set(relativePath, entries));
    }
  }, [listFiles]);

  // Load root files on mount
  useEffect(() => {
    if (projectState.currentProject) {
      loadFiles('');
    }
  }, [projectState.currentProject, loadFiles]);

  const handleFolderClick = useCallback(async (folder: FileEntry) => {
    const isExpanded = expandedFolders.has(folder.path);
    if (isExpanded) {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.delete(folder.path);
        return next;
      });
    } else {
      await loadFiles(folder.path);
      setExpandedFolders((prev) => new Set(prev).add(folder.path));
    }
  }, [expandedFolders, loadFiles]);

  const handleDelete = useCallback(async (item: FileEntry) => {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      await deleteFile(item.path);
      const parentPath = item.path.split('/').slice(0, -1).join('/');
      await loadFiles(parentPath || '');
    }
  }, [deleteFile, loadFiles]);

  const submitCreate = useCallback(async (
    creating: { parentPath: string; type: 'file' | 'folder' },
    newItemName: string
  ) => {
    if (!newItemName.trim()) return;
    const fullPath = creating.parentPath
      ? `${creating.parentPath}/${newItemName.trim()}`
      : newItemName.trim();

    if (creating.type === 'file') {
      const isNotebook = newItemName.trim().endsWith('.yaml') || newItemName.trim().endsWith('.yml');
      await createFile(fullPath, isNotebook ? 'cells: []\n' : '');
    } else {
      await createFolder(fullPath);
    }

    await loadFiles(creating.parentPath || '');
    if (creating.parentPath && !expandedFolders.has(creating.parentPath)) {
      setExpandedFolders((prev) => new Set(prev).add(creating.parentPath));
    }
  }, [createFile, createFolder, loadFiles, expandedFolders]);

  const submitRename = useCallback(async (
    renaming: { path: string; name: string }
  ) => {
    if (!renaming.name.trim()) return;
    const parentPath = renaming.path.split('/').slice(0, -1).join('/');
    const newPath = parentPath ? `${parentPath}/${renaming.name.trim()}` : renaming.name.trim();

    await renameFile(renaming.path, newPath);
    await loadFiles(parentPath || '');
  }, [renameFile, loadFiles]);

  return {
    files,
    expandedFolders,
    folderContents,
    projectName: projectState.currentProject?.name,
    loadFiles,
    handleFolderClick,
    handleDelete,
    submitCreate,
    submitRename,
  };
}
