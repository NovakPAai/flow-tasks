import { useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { Comment, WorkspaceMember } from '../types';
import * as commentsApi from '../api/comments';
import { useAuthStore } from '../store/auth.store';
import MentionTextarea, { renderMentions } from './MentionTextarea';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  authorText: 'var(--static-text-neutral-primary)', metaText: 'var(--neutral-8)', bodyText: 'var(--static-text-neutral-secondary)',
  actionText: 'var(--neutral-8)', actionHover: 'var(--static-text-neutral-tertiary)',
  inputBg: 'var(--static-background-lightest)', inputBorder: 'var(--static-border-neutral-tertiary)', inputBorderFocus: 'var(--brand-8)', inputText: 'var(--static-text-neutral-primary)',
  inputPlaceholder: 'var(--neutral-8)',
  btnBg: 'var(--brand-8)', btnText: 'var(--neutral-0)',
  cancelBg: 'var(--static-border-neutral-tertiary)', cancelBorder: 'var(--component-border-neutral-medium)', cancelText: 'var(--static-text-neutral-primary)',
  confirmBg: 'var(--static-border-neutral-tertiary)', confirmBorder: 'var(--static-border-neutral-tertiary)', confirmText: 'var(--static-text-neutral-tertiary)',
};
const LIGHT: C = {
  authorText: 'var(--static-text-neutral-primary)', metaText: 'var(--static-text-neutral-tertiary)', bodyText: 'var(--static-text-neutral-secondary)',
  actionText: 'var(--static-text-neutral-tertiary)', actionHover: 'var(--static-text-neutral-tertiary)',
  inputBg: 'var(--static-background-lightest)', inputBorder: 'var(--static-border-neutral-tertiary)', inputBorderFocus: 'var(--brand-8)', inputText: 'var(--static-text-neutral-primary)',
  inputPlaceholder: 'var(--static-text-neutral-tertiary)',
  btnBg: 'var(--brand-8)', btnText: 'var(--neutral-0)',
  cancelBg: 'var(--static-background-lightest)', cancelBorder: 'var(--static-border-neutral-tertiary)', cancelText: 'var(--static-text-neutral-primary)',
  confirmBg: 'var(--static-background-lightest)', confirmBorder: 'var(--static-border-neutral-tertiary)', confirmText: 'var(--static-text-neutral-tertiary)',
};

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['var(--brand-8)','var(--brand-gold-8)','var(--success-8)','var(--warning-6)','var(--brand-7)','var(--error-10)','var(--info-8)'];
function avatarColor(name: string): string { return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length]; }
function avatarInitials(name: string): string { return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }

// ── Character counter ──────────────────────────────────────────────────────────
const COMMENT_MAX = 10000;
function commentCharCounterStyle(len: number, metaColor: string): React.CSSProperties {
  return {
    fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, textAlign: 'right',
    marginBottom: 6,
    color: len >= COMMENT_MAX ? 'var(--error-10)' : len > COMMENT_MAX * 0.9 ? 'var(--warning-6)' : metaColor,
  };
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  taskId: string;
  comments: Comment[];
  commentsTotal?: number;
  onCommentsChanged: (comments: Comment[]) => void;
  members?: WorkspaceMember[];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CommentThread({ taskId, comments, onCommentsChanged, members = [] }: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const currentUser = useAuthStore(s => s.user);
  const [newBody, setNewBody]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody]   = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const submit = async () => {
    if (!newBody.trim()) return;
    setSubmitting(true);
    try {
      const created = await commentsApi.createComment(taskId, newBody.trim());
      onCommentsChanged([...comments, created]);
      setNewBody('');
    } catch { message.error('Не удалось отправить комментарий'); }
    finally { setSubmitting(false); }
  };

  const saveEdit = async (commentId: string) => {
    if (!editBody.trim()) return;
    try {
      const updated = await commentsApi.updateComment(commentId, editBody.trim());
      onCommentsChanged(comments.map(cm => cm.id === commentId ? updated : cm));
      setEditingId(null);
    } catch { message.error('Не удалось обновить комментарий'); }
  };

  const remove = async (commentId: string) => {
    try {
      await commentsApi.deleteComment(commentId);
      onCommentsChanged(comments.filter(cm => cm.id !== commentId));
    } catch { message.error('Не удалось удалить комментарий'); }
    finally { setConfirmId(null); }
  };

  // shared textarea style
  const textareaStyle = (focused: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box', resize: 'vertical',
    background: c.inputBg,
    border: `1px solid ${focused ? c.inputBorderFocus : c.inputBorder}`,
    borderRadius: 8, padding: '8px 10px',
    fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13,
    color: c.inputText, outline: 'none',
    minHeight: 60, marginBottom: 4,
    transition: 'border-color 0.15s',
  });


  return (
    <div>
      {/* Existing comments */}
      {comments.map(comment => (
        <div key={comment.id} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {/* Author avatar */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: avatarColor(comment.author.name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--neutral-0)' }}>
              {avatarInitials(comment.author.name)}
            </span>
          </div>

          <div style={{ flex: 1 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 600, color: c.authorText }}>
                {comment.author.name}
              </span>
              <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.metaText }}>
                {new Date(comment.createdAt).toLocaleString('ru-RU', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
                {comment.updatedAt !== comment.createdAt && ' (изм.)'}
              </span>
            </div>

            {editingId === comment.id ? (
              /* Edit mode */
              <div>
                <MentionTextarea
                  value={editBody}
                  onChange={setEditBody}
                  members={members}
                  rows={2}
                  maxLength={COMMENT_MAX}
                  style={{ ...textareaStyle(true), marginBottom: 0 }}
                />
                {editBody.length > 0 && (
                  <div style={commentCharCounterStyle(editBody.length, c.metaText)}>{editBody.length} / {COMMENT_MAX}</div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => saveEdit(comment.id)}
                    style={{
                      background: c.btnBg, border: 'none', borderRadius: 6,
                      padding: '4px 12px', cursor: 'pointer',
                      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500,
                      color: c.btnText,
                    }}
                  >
                    ✓ Сохранить
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{
                      background: c.cancelBg, border: `1px solid ${c.cancelBorder}`, borderRadius: 6,
                      padding: '4px 12px', cursor: 'pointer',
                      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
                      color: c.cancelText,
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13,
                  color: c.bodyText, whiteSpace: 'pre-wrap', flex: 1, lineHeight: '18px',
                }}>
                  {renderMentions(comment.body)}
                </span>
                {currentUser?.id === comment.authorId && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {confirmId === comment.id ? (
                      /* Inline confirm */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.confirmText }}>
                          Удалить?
                        </span>
                        <button
                          onClick={() => remove(comment.id)}
                          style={{
                            background: 'var(--component-fill-negative-soft-hover)', border: '1px solid var(--component-border-negative-medium)',
                            borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: 'var(--error-10)',
                          }}
                        >
                          Да
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          style={{
                            background: c.confirmBg, border: `1px solid ${c.confirmBorder}`,
                            borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.confirmText,
                          }}
                        >
                          Нет
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Edit btn */}
                        <button
                          onClick={() => { setEditingId(comment.id); setEditBody(comment.body); }}
                          title="Изменить"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '3px 5px', borderRadius: 4, color: c.actionText,
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = c.actionHover; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = c.actionText; }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        {/* Delete btn */}
                        <button
                          onClick={() => setConfirmId(comment.id)}
                          title="Удалить"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '3px 5px', borderRadius: 4, color: c.actionText,
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--error-10)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = c.actionText; }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* New comment input */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: avatarColor(currentUser?.name ?? ''),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--neutral-0)' }}>
            {avatarInitials(currentUser?.name ?? '')}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <MentionTextarea
            value={newBody}
            onChange={setNewBody}
            members={members}
            placeholder="Написать комментарий... (@имя для упоминания)"
            rows={2}
            maxLength={COMMENT_MAX}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
            style={{
              ...textareaStyle(false),
              color: newBody ? c.inputText : c.inputPlaceholder,
            }}
            onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = c.inputBorderFocus; }}
            onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = c.inputBorder; }}
          />
          {newBody.length > 0 && (
            <div style={commentCharCounterStyle(newBody.length, c.metaText)}>{newBody.length} / {COMMENT_MAX}</div>
          )}
          {newBody.trim() && (
            <button
              onClick={submit}
              disabled={submitting}
              style={{
                background: c.btnBg, border: 'none', borderRadius: 6,
                padding: '5px 14px', cursor: submitting ? 'default' : 'pointer',
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500,
                color: c.btnText, opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Отправка...' : 'Отправить'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
