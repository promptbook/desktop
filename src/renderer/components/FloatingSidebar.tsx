import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSession, useProject, FileEntry } from '../contexts';
import './FloatingSidebar.css';

interface FloatingSidebarProps {
  onFileSelect: (filePath: string) => void;
}

export function FloatingSidebar({ onFileSelect }: FloatingSidebarProps) {
  const { state: sessionState, setSidebarVisible, pinSidebar, resizeSidebar } = useSession();
  const { state: projectState, listFiles, createFile, createFolder, deleteFile, renameFile } = useProject();

  const [isHovering, setIsHovering] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, FileEntry[]>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item?: FileEntry; isRoot?: boolean } | null>(null);
  const [renaming, setRenaming] = useState<{ path: string; name: string } | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const sidebarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const sidebar = sessionState.session?.sidebar;
  const isVisible = sidebar?.isVisible || false;
  const isPinned = sidebar?.isPinned || false;
  const width = sidebar?.width || 280;

  // Load root files on mount
  useEffect(() => {
    if (projectState.currentProject) {
      loadFiles('');
    }
  }, [projectState.currentProject?.id]);

  const loadFiles = useCallback(async (relativePath: string) => {
    const entries = await listFiles(relativePath);
    if (relativePath === '') {
      setFiles(entries);
    } else {
      setFolderContents((prev) => new Map(prev).set(relativePath, entries));
    }
  }, [listFiles]);

  const handleTriggerEnter = useCallback(() => {
    if (!isPinned) {
      setIsHovering(true);
      setSidebarVisible(true);
    }
  }, [isPinned, setSidebarVisible]);

  const handleSidebarLeave = useCallback(() => {
    if (!isPinned && !isResizing) {
      setIsHovering(false);
      setSidebarVisible(false);
    }
  }, [isPinned, isResizing, setSidebarVisible]);

  const handlePinClick = useCallback(() => {
    pinSidebar(!isPinned);
  }, [isPinned, pinSidebar]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + delta));
      resizeSidebar(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, resizeSidebar]);

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

  const handleFileClick = useCallback((file: FileEntry) => {
    onFileSelect(file.path);
  }, [onFileSelect]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item?: FileEntry, isRoot?: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item, isRoot });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCreateFile = useCallback(async (parentPath: string) => {
    setCreating({ parentPath, type: 'file' });
    setNewItemName('');
    setContextMenu(null);
  }, []);

  const handleCreateFolder = useCallback(async (parentPath: string) => {
    setCreating({ parentPath, type: 'folder' });
    setNewItemName('');
    setContextMenu(null);
  }, []);

  const handleRename = useCallback((item: FileEntry) => {
    setRenaming({ path: item.path, name: item.name });
    setContextMenu(null);
  }, []);

  const handleDelete = useCallback(async (item: FileEntry) => {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      await deleteFile(item.path);
      // Refresh the parent folder
      const parentPath = item.path.split('/').slice(0, -1).join('/');
      await loadFiles(parentPath || '');
    }
    setContextMenu(null);
  }, [deleteFile, loadFiles]);

  const submitCreate = useCallback(async () => {
    if (!creating || !newItemName.trim()) return;
    const fullPath = creating.parentPath ? `${creating.parentPath}/${newItemName.trim()}` : newItemName.trim();

    if (creating.type === 'file') {
      const isNotebook = newItemName.trim().endsWith('.yaml') || newItemName.trim().endsWith('.yml');
      await createFile(fullPath, isNotebook ? 'cells: []\n' : '');
    } else {
      await createFolder(fullPath);
    }

    // Refresh
    await loadFiles(creating.parentPath || '');
    if (creating.parentPath && !expandedFolders.has(creating.parentPath)) {
      setExpandedFolders((prev) => new Set(prev).add(creating.parentPath));
    }
    setCreating(null);
    setNewItemName('');
  }, [creating, newItemName, createFile, createFolder, loadFiles, expandedFolders]);

  const submitRename = useCallback(async () => {
    if (!renaming || !renaming.name.trim()) return;
    const parentPath = renaming.path.split('/').slice(0, -1).join('/');
    const newPath = parentPath ? `${parentPath}/${renaming.name.trim()}` : renaming.name.trim();

    await renameFile(renaming.path, newPath);
    await loadFiles(parentPath || '');
    setRenaming(null);
  }, [renaming, renameFile, loadFiles]);

  const renderFileTree = (entries: FileEntry[], level: number = 0) => {
    return entries.map((entry) => {
      const isExpanded = expandedFolders.has(entry.path);
      const children = folderContents.get(entry.path) || [];
      const isRenaming = renaming?.path === entry.path;

      return (
        <div key={entry.path} className="file-tree__item" style={{ paddingLeft: `${level * 16 + 8}px` }}>
          <div
            className={`file-tree__row ${entry.isDirectory ? 'file-tree__row--folder' : 'file-tree__row--file'}`}
            onClick={() => entry.isDirectory ? handleFolderClick(entry) : handleFileClick(entry)}
            onContextMenu={(e) => handleContextMenu(e, entry)}
          >
            {entry.isDirectory && (
              <svg className={`file-tree__chevron ${isExpanded ? 'file-tree__chevron--expanded' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 3l4 3-4 3" />
              </svg>
            )}
            <span className="file-tree__icon">
              {entry.isDirectory ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4v8a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1H8L7 3H3a1 1 0 00-1 1z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                  <path d="M9 2v4h4" />
                </svg>
              )}
            </span>
            {isRenaming ? (
              <input
                type="text"
                className="file-tree__rename-input"
                value={renaming.name}
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="file-tree__name">{entry.name}</span>
            )}
          </div>
          {entry.isDirectory && isExpanded && children.length > 0 && (
            <div className="file-tree__children">
              {renderFileTree(children, level + 1)}
            </div>
          )}
          {entry.isDirectory && isExpanded && creating?.parentPath === entry.path && (
            <div className="file-tree__create" style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
              <span className="file-tree__icon">
                {creating.type === 'folder' ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4v8a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1H8L7 3H3a1 1 0 00-1 1z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                    <path d="M9 2v4h4" />
                  </svg>
                )}
              </span>
              <input
                type="text"
                className="file-tree__create-input"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onBlur={() => { if (!newItemName.trim()) setCreating(null); else submitCreate(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate();
                  if (e.key === 'Escape') setCreating(null);
                }}
                placeholder={creating.type === 'folder' ? 'folder name' : 'file.yaml'}
                autoFocus
              />
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* Trigger zone - only visible when sidebar is hidden */}
      {!isVisible && (
        <div
          ref={triggerRef}
          className="sidebar-trigger"
          onMouseEnter={handleTriggerEnter}
        />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`floating-sidebar ${isVisible ? 'floating-sidebar--visible' : ''} ${isPinned ? 'floating-sidebar--pinned' : ''}`}
        style={{ width: `${width}px` }}
        onMouseLeave={handleSidebarLeave}
        onClick={closeContextMenu}
      >
        {/* Header */}
        <div className="floating-sidebar__header">
          <h3>{projectState.currentProject?.name || 'Files'}</h3>
          <button
            className={`floating-sidebar__pin-btn ${isPinned ? 'floating-sidebar__pin-btn--pinned' : ''}`}
            onClick={handlePinClick}
            title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              {isPinned ? (
                <path d="M8 1L5 4 3 4 1 6 4 9 1 12M9 5l4 4-2 2-1-1" />
              ) : (
                <path d="M3 1l3 3 2 0 2-2M11 5L7 9l-2 0-2 2M1 13l4-4" />
              )}
            </svg>
          </button>
        </div>

        {/* File browser */}
        <div className="floating-sidebar__content" onContextMenu={(e) => handleContextMenu(e, undefined, true)}>
          {creating?.parentPath === '' && (
            <div className="file-tree__create" style={{ paddingLeft: '8px' }}>
              <span className="file-tree__icon">
                {creating.type === 'folder' ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4v8a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1H8L7 3H3a1 1 0 00-1 1z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                    <path d="M9 2v4h4" />
                  </svg>
                )}
              </span>
              <input
                type="text"
                className="file-tree__create-input"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onBlur={() => { if (!newItemName.trim()) setCreating(null); else submitCreate(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate();
                  if (e.key === 'Escape') setCreating(null);
                }}
                placeholder={creating.type === 'folder' ? 'folder name' : 'file.yaml'}
                autoFocus
              />
            </div>
          )}
          {files.length > 0 ? (
            <div className="file-tree">
              {renderFileTree(files)}
            </div>
          ) : (
            <div className="floating-sidebar__empty">
              <p>No files yet</p>
              <button onClick={() => handleCreateFile('')}>Create Notebook</button>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div className="floating-sidebar__resize" onMouseDown={handleResizeStart} />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="file-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item ? (
            <>
              {!contextMenu.item.isDirectory && (
                <button onClick={() => { handleFileClick(contextMenu.item!); closeContextMenu(); }}>
                  Open
                </button>
              )}
              <button onClick={() => handleRename(contextMenu.item!)}>Rename</button>
              <hr />
              <button className="file-context-menu__danger" onClick={() => handleDelete(contextMenu.item!)}>
                Delete
              </button>
            </>
          ) : (
            <>
              <button onClick={() => handleCreateFile(contextMenu.item?.path || '')}>New Notebook</button>
              <button onClick={() => handleCreateFolder(contextMenu.item?.path || '')}>New Folder</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
