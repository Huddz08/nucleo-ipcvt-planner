const icons = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
  moon: <path d="M20.9 13.2A8.5 8.5 0 0 1 10.8 3.1 8.5 8.5 0 1 0 20.9 13.2Z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2M8 18h2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><circle cx="9" cy="7" r="4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  'arrow-left': <path d="M20 12H4m6-6-6 6 6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /><circle cx="8" cy="6" r="2" fill="var(--paper, #faf9f5)" /><circle cx="15" cy="12" r="2" fill="var(--paper, #faf9f5)" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  undo: <><path d="M3 10h10a7 7 0 0 1 0 14" transform="translate(0 -5)" /><path d="m7 1-4 4 4 4" transform="translate(0 0)" /></>,
  redo: <><path d="M21 5H11a7 7 0 0 0 0 14" /><path d="m17 1 4 4-4 4" /></>,
  maximize: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />,
  pencil: <><path d="m16 3 5 5M3 21l5-1 13-13a2.1 2.1 0 0 0-5-5L3 15zM3 15l5 5" /></>,
  music: <><path d="M9 18V5l12-2v13M9 9l12-2" /><ellipse cx="6" cy="18" rx="3" ry="3" /><ellipse cx="18" cy="16" rx="3" ry="3" /></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
  guitar: <><path d="m11 13 8-8m-3-2 5 5M17 6l3-3M6.7 10.1a5.3 5.3 0 0 0-4.5 6.1 5.3 5.3 0 0 0 5.6 5.5 5.3 5.3 0 0 0 5.4-4.9c.1-1 .5-1.8 1.4-2.3 1.4-.8 1.5-2.7.4-3.8l-1.7-1.6c-1.1-1.2-3-1-3.8.4-.6.9-1.5 1.2-2.8.6Z" /><circle cx="7.7" cy="16.2" r="1.3" /></>,
  volume: <><path d="m11 5-6 4H2v6h3l6 4zM15 8a5 5 0 0 1 0 8M18 5a9 9 0 0 1 0 14" /></>,
  book: <><path d="M12 6v15M3 3h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z" /></>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M12 17v4M8 21h8" /></>,
  camera: <><path d="M14.5 4h-5L7 7H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-4z" /><circle cx="12" cy="13" r="4" /></>,
  video: <><rect x="2" y="5" width="14" height="14" rx="2" /><path d="m16 10 6-4v12l-6-4" /></>,
  settings: <><path d="m9 3 .6 2.1a7 7 0 0 1 4.8 0L15 3l3 1.7-.6 2.3a7 7 0 0 1 2.4 4.1L22 12v3l-2.2.6a7 7 0 0 1-2.4 4.1L18 22l-3 1.7-.6-2.1a7 7 0 0 1-4.8 0L9 23.7 6 22l.6-2.3a7 7 0 0 1-2.4-4.1L2 15v-3l2.2-.9A7 7 0 0 1 6.6 7L6 4.7Z" transform="translate(0 -1.3) scale(1 .96)" /><circle cx="12" cy="12" r="3" /></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01" /></>,
  'panel-left': <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M5.5 7h.01M5.5 11h.01" /></>,
  leaf: <><path d="M20 3c-5 0-13-.7-16 6-2.1 5 1.6 10 6 10 7 0 10-8 10-16ZM4 21 16 9" /></>,
  move: <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />,
  external: <><path d="M15 3h6v6m0-6L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></>,
  'arrow-up-right': <path d="M6 18 18 6M6 6h12v12" />,
  grip: <><circle cx="9" cy="5" r=".8" fill="currentColor" /><circle cx="15" cy="5" r=".8" fill="currentColor" /><circle cx="9" cy="12" r=".8" fill="currentColor" /><circle cx="15" cy="12" r=".8" fill="currentColor" /><circle cx="9" cy="19" r=".8" fill="currentColor" /><circle cx="15" cy="19" r=".8" fill="currentColor" /></>,
  notebook: <><rect x="5" y="3" width="16" height="18" rx="2" /><path d="M9 3v18M3 7h4M3 12h4M3 17h4M12 8h6M12 12h4" /></>,
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
}

export default function Icon({ name, size = 20, strokeWidth = 1.7, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {icons[name] || icons.grid}
    </svg>
  )
}
