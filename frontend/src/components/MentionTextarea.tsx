import { useEffect, useRef, useState } from 'react';
import { useThemeStore } from '../store/theme.store';
import type { WorkspaceMember } from '../types';

interface Props {
  value: string;
  onChange: (value: string) => void;
  members: WorkspaceMember[];
  placeholder?: string;
  rows?: number;
  style?: React.CSSProperties;
}

const MENTION_RE = /@\[([^\]]+)\]\([^)]+\)/g;

// Convert stored @[Name](userId) → display @Name
function storedToDisplay(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}

// Map a position in the display string to the equivalent position in the stored string
function displayPosToStoredPos(displayPos: number, stored: string): number {
  MENTION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let storedIdx = 0;
  let displayIdx = 0;

  while ((match = MENTION_RE.exec(stored)) !== null) {
    const chunkLen = match.index - storedIdx;
    if (displayIdx + chunkLen >= displayPos) {
      return storedIdx + (displayPos - displayIdx);
    }
    displayIdx += chunkLen;
    storedIdx = match.index;

    const displayMentionLen = 1 + match[1].length; // @Name
    if (displayIdx + displayMentionLen >= displayPos) {
      return storedIdx + match[0].length;
    }
    displayIdx += displayMentionLen;
    storedIdx += match[0].length;
  }
  return storedIdx + (displayPos - displayIdx);
}

// Render text with @[Name](userId) markers as styled spans for display
export function renderMentions(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <span key={match.index} style={{ color: '#4F6EF7', fontWeight: 500 }}>@{match[1]}</span>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MentionTextarea({ value, onChange, members, placeholder, rows = 4, style }: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const inputBg = isDark ? '#1C2236' : '#FAFAFA';
  const inputBorder = isDark ? '#2A3352' : '#E8E5F0';
  const textColor = isDark ? '#E2E8F8' : '#1A1A2E';
  const dropBg = isDark ? '#0F1320' : '#FFFFFF';
  const dropBorder = isDark ? '#1C2236' : '#E8E5F0';
  const hoverBg = isDark ? '#1C2236' : '#F5F5FF';
  const mutedColor = isDark ? '#8B949E' : '#9B96B8';

  // displayValue is what the textarea renders; value prop holds @[Name](userId) format
  const storedRef = useRef(value);
  const [displayValue, setDisplayValue] = useState(() => storedToDisplay(value));

  // Sync when parent resets value (e.g. after submit)
  useEffect(() => {
    if (value !== storedRef.current) {
      storedRef.current = value;
      setDisplayValue(storedToDisplay(value));
    }
  }, [value]);

  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [atStart, setAtStart] = useState(0); // position in displayValue
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.length === 0
    ? members.slice(0, 8)
    : members.filter(m => m.user.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (dropdownOpen && e.key === 'Escape') {
      setDropdownOpen(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newDisplay = e.target.value;
    const cursor = e.target.selectionStart ?? newDisplay.length;
    const oldDisplay = displayValue;
    const oldStored = storedRef.current;

    // Compute diff: common prefix + suffix
    let prefixLen = 0;
    while (prefixLen < oldDisplay.length && prefixLen < newDisplay.length &&
           oldDisplay[prefixLen] === newDisplay[prefixLen]) prefixLen++;

    let oldSuffix = 0;
    while (
      oldSuffix < oldDisplay.length - prefixLen &&
      oldSuffix < newDisplay.length - prefixLen &&
      oldDisplay[oldDisplay.length - 1 - oldSuffix] === newDisplay[newDisplay.length - 1 - oldSuffix]
    ) oldSuffix++;

    const displayInserted = newDisplay.slice(prefixLen, newDisplay.length - oldSuffix);
    const storedPrefixPos = displayPosToStoredPos(prefixLen, oldStored);
    const storedDeleteEnd = displayPosToStoredPos(prefixLen + (oldDisplay.length - prefixLen - oldSuffix), oldStored);
    const newStored = oldStored.slice(0, storedPrefixPos) + displayInserted + oldStored.slice(storedDeleteEnd);

    storedRef.current = newStored;
    setDisplayValue(newDisplay);
    onChange(newStored);

    // Detect @ trigger in displayValue
    const textBeforeCursor = newDisplay.slice(0, cursor);
    const atIdx = textBeforeCursor.lastIndexOf('@');
    if (atIdx !== -1) {
      const segment = textBeforeCursor.slice(atIdx + 1);
      if (!segment.includes(' ') && !segment.includes('\n')) {
        setQuery(segment);
        setAtStart(atIdx);
        setDropdownOpen(true);
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setDropdownPos({ top: rect.height + 4, left: 0 });
        }
        return;
      }
    }
    setDropdownOpen(false);
  }

  function selectMember(member: WorkspaceMember) {
    // atStart is a position in displayValue
    const beforeDisplay = displayValue.slice(0, atStart);
    const cursorInDisplay = textareaRef.current?.selectionStart ?? atStart + query.length + 1;
    const afterDisplay = displayValue.slice(cursorInDisplay);

    const mentionDisplay = `@${member.user.name} `;
    const mentionStored = `@[${member.user.name}](${member.user.id}) `;

    const newDisplay = beforeDisplay + mentionDisplay + afterDisplay;
    const storedBefore = storedRef.current.slice(0, displayPosToStoredPos(atStart, storedRef.current));
    const storedAfter = storedRef.current.slice(displayPosToStoredPos(cursorInDisplay, storedRef.current));
    const newStored = storedBefore + mentionStored + storedAfter;

    storedRef.current = newStored;
    setDisplayValue(newDisplay);
    onChange(newStored);
    setDropdownOpen(false);

    setTimeout(() => {
      if (textareaRef.current) {
        const pos = (beforeDisplay + mentionDisplay).length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%', resize: 'vertical',
          background: inputBg, border: `1px solid ${inputBorder}`,
          borderRadius: 6, padding: '8px 10px',
          fontSize: 13, color: textColor,
          fontFamily: '"Inter",system-ui,sans-serif',
          outline: 'none', boxSizing: 'border-box',
          ...style,
        }}
      />
      {dropdownOpen && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: dropdownPos.top, left: dropdownPos.left,
          background: dropBg, border: `1px solid ${dropBorder}`,
          borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          zIndex: 600, minWidth: 200, maxWidth: 280,
        }}>
          {filtered.map(m => (
            <button
              key={m.userId}
              type="button"
              onMouseDown={e => { e.preventDefault(); selectMember(m); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, color: textColor,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = hoverBg; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                background: '#4F6EF7', color: '#fff', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700,
              }}>
                {m.user.name.split(/\s+/).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{m.user.name}</div>
                <div style={{ fontSize: 11, color: mutedColor }}>{m.user.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
