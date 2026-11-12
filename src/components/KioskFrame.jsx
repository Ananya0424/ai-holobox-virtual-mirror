import React, { useEffect } from 'react';

export default function KioskFrame({ children }) {
  useEffect(() => {
    // Prevent accidental keyboard navigation away from the kiosk (Alt+Left/Right, Backspace outside inputs)
    const handleKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const isEditing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (!isEditing && (e.key === 'Backspace' || (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')))) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="app-portrait-viewport"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}
