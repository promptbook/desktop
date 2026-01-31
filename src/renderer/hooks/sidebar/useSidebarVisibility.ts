import { useState, useCallback } from 'react';
import { useSession } from '../../contexts';

export function useSidebarVisibility() {
  const { state: sessionState, setSidebarVisible, pinSidebar, resizeSidebar } = useSession();

  const [, setIsHovering] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const sidebar = sessionState.session?.sidebar;
  const isVisible = sidebar?.isVisible || false;
  const isPinned = sidebar?.isPinned || false;
  const width = sidebar?.width || 280;

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

  return {
    isVisible,
    isPinned,
    width,
    isResizing,
    handleTriggerEnter,
    handleSidebarLeave,
    handlePinClick,
    handleResizeStart,
  };
}
