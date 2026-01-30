import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, TabState } from '../contexts';
import './TabBar.css';

interface TabBarProps {
  onNewNotebook?: () => void;
}

export function TabBar({ onNewNotebook }: TabBarProps) {
  const { state, setActiveTab, removeTab, reorderTabs } = useSession();
  const [showOverflow, setShowOverflow] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [draggedTab, setDraggedTab] = useState<{ id: string; index: number } | null>(null);
  const [visibleTabCount, setVisibleTabCount] = useState(10);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);

  const tabs = state.session?.openTabs || [];
  const activeTabId = state.session?.activeTabId;
  const visibleTabs = tabs.slice(0, visibleTabCount);
  const overflowTabs = tabs.slice(visibleTabCount);

  // Calculate visible tab count based on container width
  useEffect(() => {
    const calculateVisibleTabs = () => {
      if (!tabsContainerRef.current) return;
      const containerWidth = tabsContainerRef.current.offsetWidth;
      const tabWidth = 160; // approximate tab width
      const newCount = Math.max(1, Math.floor(containerWidth / tabWidth) - 1); // -1 for add button
      setVisibleTabCount(newCount);
    };

    calculateVisibleTabs();
    window.addEventListener('resize', calculateVisibleTabs);
    return () => window.removeEventListener('resize', calculateVisibleTabs);
  }, []);

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
    };

    if (showOverflow) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOverflow]);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setShowOverflow(false);
  }, [setActiveTab]);

  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeTab(tabId);
  }, [removeTab]);

  const handleDragStart = useCallback((e: React.DragEvent, tab: TabState, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTab({ id: tab.id, index });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, _targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedTab && draggedTab.index !== targetIndex) {
      reorderTabs(draggedTab.index, targetIndex);
    }
    setDraggedTab(null);
  }, [draggedTab, reorderTabs]);

  const handleDragEnd = useCallback(() => {
    setDraggedTab(null);
  }, []);

  const getFileName = (filePath: string) => {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  };

  if (tabs.length === 0) {
    return (
      <div className="tab-bar tab-bar--empty">
        <button className="tab-bar__add-btn" onClick={onNewNotebook} title="New notebook">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="tab-bar" ref={tabsContainerRef}>
      <div className="tab-bar__tabs">
        {visibleTabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'tab--active' : ''} ${draggedTab?.id === tab.id ? 'tab--dragging' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab(null)}
            draggable
            onDragStart={(e) => handleDragStart(e, tab, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            title={tab.filePath}
          >
            <span className="tab__name">{getFileName(tab.filePath)}</span>
            {(hoveredTab === tab.id || tab.id === activeTabId) && (
              <button
                className="tab__close"
                onClick={(e) => handleCloseTab(e, tab.id)}
                title="Close tab"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Overflow menu */}
      {overflowTabs.length > 0 && (
        <div className="tab-bar__overflow" ref={overflowMenuRef}>
          <button
            className="tab-bar__overflow-btn"
            onClick={() => setShowOverflow(!showOverflow)}
            title={`${overflowTabs.length} more tabs`}
          >
            <span className="tab-bar__overflow-count">{overflowTabs.length}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </button>
          {showOverflow && (
            <div className="tab-bar__overflow-menu">
              {overflowTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`tab-bar__overflow-item ${tab.id === activeTabId ? 'tab-bar__overflow-item--active' : ''}`}
                  onClick={() => handleTabClick(tab.id)}
                >
                  <span className="tab-bar__overflow-item-name">{getFileName(tab.filePath)}</span>
                  <button
                    className="tab-bar__overflow-item-close"
                    onClick={(e) => handleCloseTab(e, tab.id)}
                    title="Close tab"
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3l6 6M9 3l-6 6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add new tab button */}
      <button className="tab-bar__add-btn" onClick={onNewNotebook} title="New notebook">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>
    </div>
  );
}
