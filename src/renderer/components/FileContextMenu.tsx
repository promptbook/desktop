import React from 'react';
import type { FileEntry } from '../contexts';

interface FileContextMenuProps {
  x: number;
  y: number;
  item?: FileEntry;
  onOpen?: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onClose: () => void;
}

export function FileContextMenu({
  x,
  y,
  item,
  onOpen,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
  onClose,
}: FileContextMenuProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (item) {
    // Context menu for a file or folder
    return (
      <div
        className="file-context-menu"
        style={{ top: y, left: x }}
        onClick={handleClick}
      >
        {!item.isDirectory && onOpen && (
          <button onClick={() => { onOpen(); onClose(); }}>
            Open
          </button>
        )}
        <button onClick={onRename}>Rename</button>
        <hr />
        <button className="file-context-menu__danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    );
  }

  // Context menu for empty space (root)
  return (
    <div
      className="file-context-menu"
      style={{ top: y, left: x }}
      onClick={handleClick}
    >
      <button onClick={onCreateFile}>New Notebook</button>
      <button onClick={onCreateFolder}>New Folder</button>
    </div>
  );
}
