import React from 'react';
import type { FileEntry } from '../contexts';

interface FileTreeProps {
  entries: FileEntry[];
  level?: number;
  expandedFolders: Set<string>;
  folderContents: Map<string, FileEntry[]>;
  renaming: { path: string; name: string } | null;
  creating: { parentPath: string; type: 'file' | 'folder' } | null;
  newItemName: string;
  onFolderClick: (folder: FileEntry) => void;
  onFileClick: (file: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, item?: FileEntry) => void;
  onRenameChange: (name: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onNewItemNameChange: (name: string) => void;
  onCreateSubmit: () => void;
  onCreateCancel: () => void;
}

// Icon components
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg className={`file-tree__chevron ${expanded ? 'file-tree__chevron--expanded' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 3l4 3-4 3" />
  </svg>
);

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 4v8a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1H8L7 3H3a1 1 0 00-1 1z" />
  </svg>
);

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
    <path d="M9 2v4h4" />
  </svg>
);

// Create input component
function CreateInput({
  type,
  value,
  onChange,
  onSubmit,
  onCancel,
  style,
}: {
  type: 'file' | 'folder';
  value: string;
  onChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div className="file-tree__create" style={style}>
      <span className="file-tree__icon">
        {type === 'folder' ? <FolderIcon /> : <FileIcon />}
      </span>
      <input
        type="text"
        className="file-tree__create-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => { if (!value.trim()) onCancel(); else onSubmit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={type === 'folder' ? 'folder name' : 'file.yaml'}
        autoFocus
      />
    </div>
  );
}

// Rename input component
function RenameInput({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      type="text"
      className="file-tree__rename-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit();
        if (e.key === 'Escape') onCancel();
      }}
      autoFocus
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// File tree item component
function FileTreeItem({
  entry,
  level,
  isExpanded,
  children,
  isRenaming,
  renaming,
  creating,
  newItemName,
  onFolderClick,
  onFileClick,
  onContextMenu,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onNewItemNameChange,
  onCreateSubmit,
  onCreateCancel,
}: {
  entry: FileEntry;
  level: number;
  isExpanded: boolean;
  children: FileEntry[];
  isRenaming: boolean;
  renaming: { path: string; name: string } | null;
  creating: { parentPath: string; type: 'file' | 'folder' } | null;
  newItemName: string;
  onFolderClick: (folder: FileEntry) => void;
  onFileClick: (file: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, item: FileEntry) => void;
  onRenameChange: (name: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onNewItemNameChange: (name: string) => void;
  onCreateSubmit: () => void;
  onCreateCancel: () => void;
}) {
  return (
    <div className="file-tree__item" style={{ paddingLeft: `${level * 16 + 8}px` }}>
      <div
        className={`file-tree__row ${entry.isDirectory ? 'file-tree__row--folder' : 'file-tree__row--file'}`}
        onClick={() => entry.isDirectory ? onFolderClick(entry) : onFileClick(entry)}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {entry.isDirectory && <ChevronIcon expanded={isExpanded} />}
        <span className="file-tree__icon">
          {entry.isDirectory ? <FolderIcon /> : <FileIcon />}
        </span>
        {isRenaming && renaming ? (
          <RenameInput
            value={renaming.name}
            onChange={onRenameChange}
            onSubmit={onRenameSubmit}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="file-tree__name">{entry.name}</span>
        )}
      </div>
      {entry.isDirectory && isExpanded && children.length > 0 && (
        <div className="file-tree__children">
          <FileTree
            entries={children}
            level={level + 1}
            expandedFolders={new Set()}
            folderContents={new Map()}
            renaming={renaming}
            creating={creating}
            newItemName={newItemName}
            onFolderClick={onFolderClick}
            onFileClick={onFileClick}
            onContextMenu={onContextMenu}
            onRenameChange={onRenameChange}
            onRenameSubmit={onRenameSubmit}
            onRenameCancel={onRenameCancel}
            onNewItemNameChange={onNewItemNameChange}
            onCreateSubmit={onCreateSubmit}
            onCreateCancel={onCreateCancel}
          />
        </div>
      )}
      {entry.isDirectory && isExpanded && creating?.parentPath === entry.path && (
        <CreateInput
          type={creating.type}
          value={newItemName}
          onChange={onNewItemNameChange}
          onSubmit={onCreateSubmit}
          onCancel={onCreateCancel}
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        />
      )}
    </div>
  );
}

export function FileTree({
  entries,
  level = 0,
  expandedFolders,
  folderContents,
  renaming,
  creating,
  newItemName,
  onFolderClick,
  onFileClick,
  onContextMenu,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onNewItemNameChange,
  onCreateSubmit,
  onCreateCancel,
}: FileTreeProps) {
  return (
    <>
      {entries.map((entry) => {
        const isExpanded = expandedFolders.has(entry.path);
        const children = folderContents.get(entry.path) || [];
        const isRenaming = renaming?.path === entry.path;

        return (
          <FileTreeItem
            key={entry.path}
            entry={entry}
            level={level}
            isExpanded={isExpanded}
            children={children}
            isRenaming={isRenaming}
            renaming={renaming}
            creating={creating}
            newItemName={newItemName}
            onFolderClick={onFolderClick}
            onFileClick={onFileClick}
            onContextMenu={onContextMenu}
            onRenameChange={onRenameChange}
            onRenameSubmit={onRenameSubmit}
            onRenameCancel={onRenameCancel}
            onNewItemNameChange={onNewItemNameChange}
            onCreateSubmit={onCreateSubmit}
            onCreateCancel={onCreateCancel}
          />
        );
      })}
    </>
  );
}

export { CreateInput };
