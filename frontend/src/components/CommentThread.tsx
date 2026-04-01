import { useState } from 'react';
import { Avatar, Button, Input, Popconfirm, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { Comment } from '../types';
import * as commentsApi from '../api/comments';
import { useAuthStore } from '../store/auth.store';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  taskId: string;
  comments: Comment[];
  onCommentsChanged: (comments: Comment[]) => void;
}

export default function CommentThread({ taskId, comments, onCommentsChanged }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

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
      onCommentsChanged(comments.map((c) => (c.id === commentId ? updated : c)));
      setEditingId(null);
    } catch { message.error('Не удалось обновить комментарий'); }
  };

  const remove = async (commentId: string) => {
    try {
      await commentsApi.deleteComment(commentId);
      onCommentsChanged(comments.filter((c) => c.id !== commentId));
    } catch { message.error('Не удалось удалить комментарий'); }
  };

  return (
    <div>
      {/* Existing comments */}
      {comments.map((comment) => (
        <div key={comment.id} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Avatar size={28} src={comment.author.avatar} style={{ background: '#4F6EF7', fontSize: 11, flexShrink: 0 }}>
            {comment.author.name?.[0]?.toUpperCase()}
          </Avatar>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ color: '#E2E8F8', fontSize: 12, fontWeight: 600 }}>{comment.author.name}</Text>
              <Text style={{ color: '#4A5578', fontSize: 11 }}>
                {new Date(comment.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {comment.updatedAt !== comment.createdAt && ' (изм.)'}
              </Text>
            </div>

            {editingId === comment.id ? (
              <div>
                <TextArea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={2}
                  autoFocus
                  style={{ background: '#0F1320', border: '1px solid #4F6EF7', color: '#E2E8F8', resize: 'none', marginBottom: 6 }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => saveEdit(comment.id)}>
                    Сохранить
                  </Button>
                  <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingId(null)}>
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ color: '#C8D0E8', fontSize: 13, whiteSpace: 'pre-wrap', flex: 1 }}>
                  {comment.body}
                </Text>
                {currentUser?.id === comment.authorId && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <Button
                      type="text" size="small" icon={<EditOutlined />}
                      style={{ color: '#4A5578' }}
                      onClick={() => { setEditingId(comment.id); setEditBody(comment.body); }}
                    />
                    <Popconfirm title="Удалить комментарий?" onConfirm={() => remove(comment.id)} okText="Да" cancelText="Нет">
                      <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* New comment input */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Avatar size={28} style={{ background: '#4F6EF7', fontSize: 11, flexShrink: 0 }}>
          {currentUser?.name?.[0]?.toUpperCase()}
        </Avatar>
        <div style={{ flex: 1 }}>
          <TextArea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Написать комментарий..."
            rows={2}
            style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#E2E8F8', resize: 'none', marginBottom: 6 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          />
          {newBody.trim() && (
            <Button size="small" type="primary" loading={submitting} onClick={submit}
              style={{ background: '#4F6EF7' }}>
              Отправить
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
