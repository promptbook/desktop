import { useState, useCallback } from 'react';
import type { FileEntry } from '../contexts';
import { useSidebarVisibility, useSidebarFiles } from './sidebar';

export interface FloatingSidebarState {
  files: FileEntry[];
  expandedFolders: Set<string>;
  folderContents: Map<string, FileEntry[]>;
  contextMenu: { x: number; y: number; item?: FileEntry; isRoot?: boolean } | null;
  renaming: { path: string; name: string } | null;
  creating: { parentPath: string; type: 'file' | 'folder' } | null;
  newItemName: string;
  isResizing: boolean;
}

export interface FloatingSidebarHandlers {
  loadFiles: (relativePath: string) => Promise<void>;
  handleTriggerEnter: () => void;
  handleSidebarLeave: () => void;
  handlePinClick: () => void;
  handleResizeStart: (e: React.MouseEvent) => void;
  handleFolderClick: (folder: FileEntry) => Promise<void>;
  handleFileClick: (file: FileEntry) => void;
  handleContextMenu: (e: React.MouseEvent, item?: FileEntry, isRoot?: boolean) => void;
  closeContextMenu: () => void;
  handleCreateFile: (parentPath: string) => void;
  handleCreateFolder: (parentPath: string) => void;
  handleRename: (item: FileEntry) => void;
  handleDelete: (item: FileEntry) => Promise<void>;
  submitCreate: () => Promise<void>;
  submitRename: () => Promise<void>;
  setRenaming: (value: { path: string; name: string } | null) => void;
  setCreating: (value: { parentPath: string; type: 'file' | 'folder' } | null) => void;
  setNewItemName: (value: string) => void;
}

export interface FloatingSidebarConfig {
  isVisible: boolean;
  isPinned: boolean;
  width: number;
  projectName: string | undefined;
}

export function useFloatingSidebar(onFileSelect: (filePath: string) => void): {
  state: FloatingSidebarState;
  handlers: FloatingSidebarHandlers;
  config: FloatingSidebarConfig;
} {
  const visibility = useSidebarVisibility();
  const fileOps = useSidebarFiles();

  const [contextMenu, setContextMenu] = useState<FloatingSidebarState['contextMenu']>(null);
  const [renaming, setRenaming] = useState<FloatingSidebarState['renaming']>(null);
  const [creating, setCreating] = useState<FloatingSidebarState['creating']>(null);
  const [newItemName, setNewItemName] = useState('');

  const handleFileClick = useCallback((file: FileEntry) => {
    onFileSelect(file.path);
  }, [onFileSelect]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item?: FileEntry, isRoot?: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item, isRoot });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleCreateFile = useCallback((parentPath: string) => {
    setCreating({ parentPath, type: 'file' });
    setNewItemName('');
    setContextMenu(null);
  }, []);

  const handleCreateFolder = useCallback((parentPath: string) => {
    setCreating({ parentPath, type: 'folder' });
    setNewItemName('');
    setContextMenu(null);
  }, []);

  const handleRename = useCallback((item: FileEntry) => {
    setRenaming({ path: item.path, name: item.name });
    setContextMenu(null);
  }, []);

  const handleDelete = useCallback(async (item: FileEntry) => {
    await fileOps.handleDelete(item);
    setContextMenu(null);
  }, [fileOps]);

  const submitCreate = useCallback(async () => {
    if (!creating) return;
    await fileOps.submitCreate(creating, newItemName);
    setCreating(null);
    setNewItemName('');
  }, [creating, newItemName, fileOps]);

  const submitRename = useCallback(async () => {
    if (!renaming) return;
    await fileOps.submitRename(renaming);
    setRenaming(null);
  }, [renaming, fileOps]);

  return {
    state: {
      files: fileOps.files,
      expandedFolders: fileOps.expandedFolders,
      folderContents: fileOps.folderContents,
      contextMenu,
      renaming,
      creating,
      newItemName,
      isResizing: visibility.isResizing,
    },
    handlers: {
      loadFiles: fileOps.loadFiles,
      handleTriggerEnter: visibility.handleTriggerEnter,
      handleSidebarLeave: visibility.handleSidebarLeave,
      handlePinClick: visibility.handlePinClick,
      handleResizeStart: visibility.handleResizeStart,
      handleFolderClick: fileOps.handleFolderClick,
      handleFileClick,
      handleContextMenu,
      closeContextMenu,
      handleCreateFile,
      handleCreateFolder,
      handleRename,
      handleDelete,
      submitCreate,
      submitRename,
      setRenaming,
      setCreating,
      setNewItemName,
    },
    config: {
      isVisible: visibility.isVisible,
      isPinned: visibility.isPinned,
      width: visibility.width,
      projectName: fileOps.projectName,
    },
  };
}
