import { Input, Select, Button, Tag, Tooltip } from 'antd';
import { SearchOutlined, CloseOutlined } from '@ant-design/icons';
import type { WorkflowStatus, WorkspaceMember, Label } from '../types';

export interface FilterState {
  search: string;
  statusId: string;
  priority: string;
  assigneeId: string;
  labelId: string;
  duePreset: string;
}

export const EMPTY_FILTERS: FilterState = {
  search: '', statusId: '', priority: '', assigneeId: '', labelId: '', duePreset: '',
};

interface Props {
  filters: FilterState;
  statuses: WorkflowStatus[];
  members: WorkspaceMember[];
  labels: Label[];
  onChange: (filters: FilterState) => void;
}

const DUE_OPTS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'this_week', label: 'Эта неделя' },
  { value: 'next_week', label: 'Следующая' },
  { value: 'overdue', label: '⚠ Просрочено' },
  { value: 'no_date', label: 'Без даты' },
];

const PRIORITY_OPTS = [
  { value: 'HIGH', label: '🔴 Высокий' },
  { value: 'MEDIUM', label: '🟡 Средний' },
  { value: 'LOW', label: '⚪ Низкий' },
];

const SELECT_STYLE = { minWidth: 130 };

export default function FilterBar({ filters, statuses, members, labels, onChange }: Props) {
  const set = (key: keyof FilterState, value: string) =>
    onChange({ ...filters, [key]: value });

  const hasActive = Object.values(filters).some(Boolean);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 24px', background: '#0A0E1A',
      borderBottom: '1px solid #1E2640', flexWrap: 'wrap',
    }}>
      {/* Search */}
      <Input
        prefix={<SearchOutlined style={{ color: '#4A5578' }} />}
        placeholder="Поиск задач..."
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
        allowClear
        style={{ width: 200, background: '#0F1320', border: '1px solid #1E2640' }}
        size="small"
      />

      {/* Status */}
      <Select
        value={filters.statusId || undefined}
        placeholder="Статус"
        allowClear
        size="small"
        style={SELECT_STYLE}
        onChange={(v) => set('statusId', v ?? '')}
        options={statuses.map((s) => ({
          value: s.id,
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {s.name}
            </span>
          ),
        }))}
      />

      {/* Priority */}
      <Select
        value={filters.priority || undefined}
        placeholder="Приоритет"
        allowClear
        size="small"
        style={SELECT_STYLE}
        onChange={(v) => set('priority', v ?? '')}
        options={PRIORITY_OPTS}
      />

      {/* Assignee */}
      {members.length > 0 && (
        <Select
          value={filters.assigneeId || undefined}
          placeholder="Исполнитель"
          allowClear
          size="small"
          style={{ minWidth: 150 }}
          onChange={(v) => set('assigneeId', v ?? '')}
          options={members.map((m) => ({ value: m.userId, label: m.user.name }))}
        />
      )}

      {/* Label */}
      {labels.length > 0 && (
        <Select
          value={filters.labelId || undefined}
          placeholder="Метка"
          allowClear
          size="small"
          style={SELECT_STYLE}
          onChange={(v) => set('labelId', v ?? '')}
          options={labels.map((l) => ({
            value: l.id,
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                {l.name}
              </span>
            ),
          }))}
        />
      )}

      {/* Due preset */}
      <Select
        value={filters.duePreset || undefined}
        placeholder="Срок"
        allowClear
        size="small"
        style={SELECT_STYLE}
        onChange={(v) => set('duePreset', v ?? '')}
        options={DUE_OPTS}
      />

      {/* Clear all */}
      {hasActive && (
        <Tooltip title="Сбросить фильтры">
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => onChange(EMPTY_FILTERS)}
            style={{ color: '#4A5578' }}
          />
        </Tooltip>
      )}

      {/* Active filter chips */}
      {hasActive && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {filters.statusId && (
            <Tag closable onClose={() => set('statusId', '')} style={{ background: '#1E2640', border: 'none', color: '#8B95B0', fontSize: 11 }}>
              {statuses.find((s) => s.id === filters.statusId)?.name ?? 'Статус'}
            </Tag>
          )}
          {filters.priority && (
            <Tag closable onClose={() => set('priority', '')} style={{ background: '#1E2640', border: 'none', color: '#8B95B0', fontSize: 11 }}>
              {PRIORITY_OPTS.find((p) => p.value === filters.priority)?.label}
            </Tag>
          )}
          {filters.assigneeId && (
            <Tag closable onClose={() => set('assigneeId', '')} style={{ background: '#1E2640', border: 'none', color: '#8B95B0', fontSize: 11 }}>
              {members.find((m) => m.userId === filters.assigneeId)?.user.name}
            </Tag>
          )}
          {filters.labelId && (
            <Tag closable onClose={() => set('labelId', '')} style={{ background: '#1E2640', border: 'none', color: '#8B95B0', fontSize: 11 }}>
              {labels.find((l) => l.id === filters.labelId)?.name}
            </Tag>
          )}
          {filters.duePreset && (
            <Tag closable onClose={() => set('duePreset', '')} style={{ background: '#1E2640', border: 'none', color: '#8B95B0', fontSize: 11 }}>
              {DUE_OPTS.find((d) => d.value === filters.duePreset)?.label}
            </Tag>
          )}
        </div>
      )}
    </div>
  );
}
