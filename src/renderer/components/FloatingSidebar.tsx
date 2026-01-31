import React, { useRef } from 'react';
import { useFloatingSidebar } from '../hooks/useFloatingSidebar';
import { FileTree, CreateInput } from './FileTree';
import { FileContextMenu } from './FileContextMenu';
import { SidebarHeader } from './SidebarHeader';
import './FloatingSidebar.css';

interface FloatingSidebarProps {
  onFileSelect: (filePath: string) => void;
}

export function FloatingSidebar({ onFileSelect }: FloatingSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const { state, handlers, config } = useFloatingSidebar(onFileSelect);
  const { isVisible, isPinned, width, projectName } = config;
  const {
    files,
    expandedFolders,
    folderContents,
    contextMenu,
    renaming,
    creating,
    newItemName,
  } = state;

  return (
    <>
      {/* Trigger zone - only visible when sidebar is hidden */}
      {!isVisible && (
        <div
          ref={triggerRef}
          className="sidebar-trigger"
          onMouseEnter={handlers.handleTriggerEnter}
        />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`floating-sidebar ${isVisible ? 'floating-sidebar--visible' : ''} ${isPinned ? 'floating-sidebar--pinned' : ''}`}
        style={{ width: `${width}px` }}
        onMouseLeave={handlers.handleSidebarLeave}
        onClick={handlers.closeContextMenu}
      >
        <SidebarHeader
          title={projectName || 'Files'}
          isPinned={isPinned}
          onPinClick={handlers.handlePinClick}
        />

        {/* File browser */}
        <div
          className="floating-sidebar__content"
          onContextMenu={(e) => handlers.handleContextMenu(e, undefined, true)}
        >
          {creating?.parentPath === '' && (
            <CreateInput
              type={creating.type}
              value={newItemName}
              onChange={handlers.setNewItemName}
              onSubmit={handlers.submitCreate}
              onCancel={() => handlers.setCreating(null)}
              style={{ paddingLeft: '8px' }}
            />
          )}
          {files.length > 0 ? (
            <div className="file-tree">
              <FileTree
                entries={files}
                expandedFolders={expandedFolders}
                folderContents={folderContents}
                renaming={renaming}
                creating={creating}
                newItemName={newItemName}
                onFolderClick={handlers.handleFolderClick}
                onFileClick={handlers.handleFileClick}
                onContextMenu={handlers.handleContextMenu}
                onRenameChange={(name) => renaming && handlers.setRenaming({ ...renaming, name })}
                onRenameSubmit={handlers.submitRename}
                onRenameCancel={() => handlers.setRenaming(null)}
                onNewItemNameChange={handlers.setNewItemName}
                onCreateSubmit={handlers.submitCreate}
                onCreateCancel={() => handlers.setCreating(null)}
              />
            </div>
          ) : (
            <div className="floating-sidebar__empty">
              <p>No files yet</p>
              <button onClick={() => handlers.handleCreateFile('')}>Create Notebook</button>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div className="floating-sidebar__resize" onMouseDown={handlers.handleResizeStart} />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onOpen={contextMenu.item ? () => handlers.handleFileClick(contextMenu.item!) : undefined}
          onRename={() => contextMenu.item && handlers.handleRename(contextMenu.item)}
          onDelete={() => contextMenu.item && handlers.handleDelete(contextMenu.item)}
          onCreateFile={() => handlers.handleCreateFile(contextMenu.item?.path || '')}
          onCreateFolder={() => handlers.handleCreateFolder(contextMenu.item?.path || '')}
          onClose={handlers.closeContextMenu}
        />
      )}
    </>
  );
}
