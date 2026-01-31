import React from 'react';

interface SidebarHeaderProps {
  title: string;
  isPinned: boolean;
  onPinClick: () => void;
}

const PinIcon = ({ isPinned }: { isPinned: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    {isPinned ? (
      <path d="M8 1L5 4 3 4 1 6 4 9 1 12M9 5l4 4-2 2-1-1" />
    ) : (
      <path d="M3 1l3 3 2 0 2-2M11 5L7 9l-2 0-2 2M1 13l4-4" />
    )}
  </svg>
);

export function SidebarHeader({ title, isPinned, onPinClick }: SidebarHeaderProps) {
  return (
    <div className="floating-sidebar__header">
      <h3>{title}</h3>
      <button
        className={`floating-sidebar__pin-btn ${isPinned ? 'floating-sidebar__pin-btn--pinned' : ''}`}
        onClick={onPinClick}
        title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
      >
        <PinIcon isPinned={isPinned} />
      </button>
    </div>
  );
}
