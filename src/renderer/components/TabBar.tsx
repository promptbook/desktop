import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSession, useProject, TabState } from '../contexts';
import './TabBar.css';

interface TabBarProps {
  onNewNotebook?: () => void;
}

interface TabContextMenu {
  x: number;
  y: number;
  tab: TabState;
}

function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

// Custom hook for tab bar state and handlers
function useTabBar() {
  const { state, setActiveTab, removeTab, reorderTabs, updateTab } = useSession();
  const { renameFile } = useProject();
  const [showOverflow, setShowOverflow] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [draggedTab, setDraggedTab] = useState<{ id: string; index: number } | null>(null);
  const [visibleTabCount, setVisibleTabCount] = useState(10);
  const [contextMenu, setContextMenu] = useState<TabContextMenu | null>(null);
  const [renaming, setRenaming] = useState<{ tabId: string; currentName: string } | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo(() => state.session?.openTabs || [], [state.session?.openTabs]);
  const activeTabId = state.session?.activeTabId;
  const visibleTabs = tabs.slice(0, visibleTabCount);
  const overflowTabs = tabs.slice(visibleTabCount);

  useEffect(() => {
    const calculateVisibleTabs = () => {
      if (!tabsContainerRef.current) return;
      const containerWidth = tabsContainerRef.current.offsetWidth;
      const newCount = Math.max(1, Math.floor(containerWidth / 160) - 1);
      setVisibleTabCount(newCount);
    };
    calculateVisibleTabs();
    window.addEventListener('resize', calculateVisibleTabs);
    return () => window.removeEventListener('resize', calculateVisibleTabs);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) setShowOverflow(false);
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    if (showOverflow || contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOverflow, contextMenu]);

  const handleTabClick = useCallback((tabId: string) => { setActiveTab(tabId); setShowOverflow(false); }, [setActiveTab]);
  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => { e.stopPropagation(); removeTab(tabId); }, [removeTab]);
  const handleDragStart = useCallback((e: React.DragEvent, tab: TabState, index: number) => {
    e.dataTransfer.effectAllowed = 'move'; setDraggedTab({ id: tab.id, index });
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedTab && draggedTab.index !== targetIndex) reorderTabs(draggedTab.index, targetIndex);
    setDraggedTab(null);
  }, [draggedTab, reorderTabs]);
  const handleContextMenu = useCallback((e: React.MouseEvent, tab: TabState) => {
    e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, tab });
  }, []);
  const handleRenameStart = useCallback((tab: TabState) => {
    setRenaming({ tabId: tab.id, currentName: getFileName(tab.filePath).replace(/\.(yaml|yml)$/, '') });
    setContextMenu(null);
  }, []);
  const handleRenameSubmit = useCallback(async (newName: string) => {
    if (!renaming) return;
    const tab = tabs.find(t => t.id === renaming.tabId);
    if (!tab || !newName.trim()) { setRenaming(null); return; }
    const ext = tab.filePath.match(/\.(yaml|yml)$/)?.[0] || '.yaml';
    const newFileName = newName.trim().endsWith('.yaml') || newName.trim().endsWith('.yml') ? newName.trim() : `${newName.trim()}${ext}`;
    const dirPath = tab.filePath.split('/').slice(0, -1).join('/');
    const newFilePath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
    if (newFilePath !== tab.filePath) {
      const success = await renameFile(tab.filePath, newFilePath);
      if (success) await updateTab(tab.id, { filePath: newFilePath });
    }
    setRenaming(null);
  }, [renaming, tabs, renameFile, updateTab]);
  const handleCloseFromMenu = useCallback((tab: TabState) => { removeTab(tab.id); setContextMenu(null); }, [removeTab]);

  return {
    tabs, activeTabId, visibleTabs, overflowTabs, showOverflow, hoveredTab, draggedTab, contextMenu, renaming,
    tabsContainerRef, overflowMenuRef, contextMenuRef,
    setShowOverflow, setHoveredTab, setDraggedTab, setRenaming,
    handleTabClick, handleCloseTab, handleDragStart, handleDragOver, handleDrop,
    handleContextMenu, handleRenameStart, handleRenameSubmit, handleCloseFromMenu,
  };
}

// Sub-component: Individual tab item
function TabItem({ tab, index, isActive, isHovered, isDragging, renaming, handlers }: {
  tab: TabState; index: number; isActive: boolean; isHovered: boolean; isDragging: boolean;
  renaming: { tabId: string; currentName: string } | null;
  handlers: {
    onTabClick: (id: string) => void; onContextMenu: (e: React.MouseEvent, tab: TabState) => void;
    onMouseEnter: () => void; onMouseLeave: () => void;
    onDragStart: (e: React.DragEvent, tab: TabState, i: number) => void;
    onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent, i: number) => void; onDragEnd: () => void;
    onCloseTab: (e: React.MouseEvent, id: string) => void;
    onRenameChange: (v: string) => void; onRenameSubmit: (n: string) => void; onRenameCancel: () => void;
  };
}) {
  const isRenaming = renaming?.tabId === tab.id;
  return (
    <div className={`tab ${isActive ? 'tab--active' : ''} ${isDragging ? 'tab--dragging' : ''}`}
      onClick={() => handlers.onTabClick(tab.id)} onContextMenu={(e) => handlers.onContextMenu(e, tab)}
      onMouseEnter={handlers.onMouseEnter} onMouseLeave={handlers.onMouseLeave} draggable={!renaming}
      onDragStart={(e) => handlers.onDragStart(e, tab, index)} onDragOver={handlers.onDragOver}
      onDrop={(e) => handlers.onDrop(e, index)} onDragEnd={handlers.onDragEnd} title={tab.filePath}>
      {isRenaming ? (
        <input className="tab__rename-input" value={renaming.currentName}
          onChange={(e) => handlers.onRenameChange(e.target.value)}
          onBlur={() => handlers.onRenameSubmit(renaming.currentName)}
          onKeyDown={(e) => { if (e.key === 'Enter') handlers.onRenameSubmit(renaming.currentName); if (e.key === 'Escape') handlers.onRenameCancel(); }}
          onClick={(e) => e.stopPropagation()} autoFocus />
      ) : <span className="tab__name">{getFileName(tab.filePath)}</span>}
      {(isHovered || isActive) && !renaming && (
        <button className="tab__close" onClick={(e) => handlers.onCloseTab(e, tab.id)} title="Close tab">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6" /></svg>
        </button>
      )}
    </div>
  );
}

// Sub-component: Overflow menu for hidden tabs
function OverflowMenu({ tabs, activeTabId, showOverflow, onToggle, onTabClick, onCloseTab, menuRef }: {
  tabs: TabState[]; activeTabId: string | undefined; showOverflow: boolean;
  onToggle: () => void; onTabClick: (id: string) => void; onCloseTab: (e: React.MouseEvent, id: string) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (tabs.length === 0) return null;
  return (
    <div className="tab-bar__overflow" ref={menuRef}>
      <button className="tab-bar__overflow-btn" onClick={onToggle} title={`${tabs.length} more tabs`}>
        <span className="tab-bar__overflow-count">{tabs.length}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3" /></svg>
      </button>
      {showOverflow && (
        <div className="tab-bar__overflow-menu">
          {tabs.map((tab) => (
            <div key={tab.id} className={`tab-bar__overflow-item ${tab.id === activeTabId ? 'tab-bar__overflow-item--active' : ''}`}
              onClick={() => onTabClick(tab.id)}>
              <span className="tab-bar__overflow-item-name">{getFileName(tab.filePath)}</span>
              <button className="tab-bar__overflow-item-close" onClick={(e) => onCloseTab(e, tab.id)} title="Close tab">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Sub-component: Context menu
function TabContextMenuComponent({ menu, menuRef, onRename, onClose }: {
  menu: TabContextMenu; menuRef: React.RefObject<HTMLDivElement | null>;
  onRename: (tab: TabState) => void; onClose: (tab: TabState) => void;
}) {
  return (
    <div ref={menuRef} className="tab-context-menu" style={{ top: menu.y, left: menu.x }}>
      <button onClick={() => onRename(menu.tab)}>Rename</button><hr /><button onClick={() => onClose(menu.tab)}>Close</button>
    </div>
  );
}

// Sub-component: Add button
function AddButton({ onClick }: { onClick?: () => void }) {
  return (
    <button className="tab-bar__add-btn" onClick={onClick} title="New notebook">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" /></svg>
    </button>
  );
}

export function TabBar({ onNewNotebook }: TabBarProps) {
  const {
    tabs, activeTabId, visibleTabs, overflowTabs, showOverflow, hoveredTab, draggedTab, contextMenu, renaming,
    tabsContainerRef, overflowMenuRef, contextMenuRef, setShowOverflow, setHoveredTab, setDraggedTab, setRenaming,
    handleTabClick, handleCloseTab, handleDragStart, handleDragOver, handleDrop,
    handleContextMenu, handleRenameStart, handleRenameSubmit, handleCloseFromMenu,
  } = useTabBar();

  if (tabs.length === 0) {
    return <div className="tab-bar tab-bar--empty"><AddButton onClick={onNewNotebook} /></div>;
  }

  const tabHandlers = {
    onTabClick: handleTabClick, onContextMenu: handleContextMenu,
    onMouseEnter: () => {}, onMouseLeave: () => {},
    onDragStart: handleDragStart, onDragOver: handleDragOver, onDrop: handleDrop, onDragEnd: () => setDraggedTab(null),
    onCloseTab: handleCloseTab,
    onRenameChange: (v: string) => renaming && setRenaming({ ...renaming, currentName: v }),
    onRenameSubmit: handleRenameSubmit, onRenameCancel: () => setRenaming(null),
  };

  return (
    <div className="tab-bar" ref={tabsContainerRef}>
      <div className="tab-bar__tabs">
        {visibleTabs.map((tab, index) => (
          <TabItem key={tab.id} tab={tab} index={index} isActive={tab.id === activeTabId}
            isHovered={hoveredTab === tab.id} isDragging={draggedTab?.id === tab.id} renaming={renaming}
            handlers={{ ...tabHandlers, onMouseEnter: () => setHoveredTab(tab.id), onMouseLeave: () => setHoveredTab(null) }} />
        ))}
      </div>
      <OverflowMenu tabs={overflowTabs} activeTabId={activeTabId} showOverflow={showOverflow}
        onToggle={() => setShowOverflow(!showOverflow)} onTabClick={handleTabClick} onCloseTab={handleCloseTab} menuRef={overflowMenuRef} />
      <AddButton onClick={onNewNotebook} />
      {contextMenu && <TabContextMenuComponent menu={contextMenu} menuRef={contextMenuRef} onRename={handleRenameStart} onClose={handleCloseFromMenu} />}
    </div>
  );
}
