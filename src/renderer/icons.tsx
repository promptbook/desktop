import React from 'react';

export const Icons = {
  folder: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4.5a1 1 0 0 1 1-1h3.172a1 1 0 0 1 .707.293l1.414 1.414a1 1 0 0 0 .707.293H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8z" />
    </svg>
  ),
  save: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.414a1 1 0 0 0-.293-.707l-2.414-2.414A1 1 0 0 0 9.586 2H4a1 1 0 0 0-1 1z" />
      <path d="M5 2v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V2" />
      <path d="M5 14v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2" />
      <path d="M13.5 8a5.5 5.5 0 0 0-.1-1.1l1.3-.9a.3.3 0 0 0 .1-.4l-1.2-2.1a.3.3 0 0 0-.4-.1l-1.5.6a5 5 0 0 0-1-.6l-.2-1.6a.3.3 0 0 0-.3-.3H7.8a.3.3 0 0 0-.3.3l-.2 1.6a5 5 0 0 0-1 .6l-1.5-.6a.3.3 0 0 0-.4.1L3.2 5.6a.3.3 0 0 0 .1.4l1.3.9A5.5 5.5 0 0 0 4.5 8c0 .4 0 .7.1 1.1l-1.3.9a.3.3 0 0 0-.1.4l1.2 2.1a.3.3 0 0 0 .4.1l1.5-.6a5 5 0 0 0 1 .6l.2 1.6a.3.3 0 0 0 .3.3h2.4a.3.3 0 0 0 .3-.3l.2-1.6a5 5 0 0 0 1-.6l1.5.6a.3.3 0 0 0 .4-.1l1.2-2.1a.3.3 0 0 0-.1-.4l-1.3-.9a5.5 5.5 0 0 0 .1-1.1z" />
    </svg>
  ),
  logo: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {/* Notebook base */}
      <rect x="4" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Binding */}
      <path d="M4 7h14M4 17h14" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      {/* AI sparkle */}
      <path d="M11 10l1.2 2.4 2.8.4-2 2 .5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-2 2.8-.4L11 10z" fill="currentColor" opacity="0.9" />
    </svg>
  ),
  runAll: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 3l8 5-8 5V3z" fill="currentColor" />
      <path d="M13 3v10" />
    </svg>
  ),
  clearOutputs: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  ),
  chevronDown: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  ),
  variables: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h10M3 8h7M3 12h4" />
      <circle cx="12" cy="8" r="2" />
      <circle cx="10" cy="12" r="2" />
    </svg>
  ),
  export: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v9M4 7l4-5 4 5" />
      <path d="M3 11v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />
    </svg>
  ),
  undo: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6h7a4 4 0 0 1 0 8H8" />
      <path d="M6 3L3 6l3 3" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3 3" />
    </svg>
  ),
  sun: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
    </svg>
  ),
  moon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4 4 0 0 0 6 6z" />
    </svg>
  ),
  system: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="9" rx="1" />
      <path d="M5 15h6M8 12v3" />
    </svg>
  ),
};
