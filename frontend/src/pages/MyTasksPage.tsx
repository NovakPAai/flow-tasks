import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Empty, Input, Select, Segmented,
  Spin, Table, Tag, Typography, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined, BranchesOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import * as tasksApi from '../api/tasks';
import type { MyTask } from '../api/tasks';

const { Title, Text } = Typography;
const { Search } = Input;

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#6B7280',
};
const PRIORITY_LABEL: Record<string, string> = {
  HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий',
};
const DUE_OPTS = [
  { value: '', label: 'Все' },
  { value: 'today', label: 'Сегодня' },
  { value: 'this_week', label: 'Эта неделя' },
  { value: 'next_week', label: 'Следующая' },
  { value: 'overdue', label: 'Просрочено' },
  { value: 'no_date', label: 'Без даты' },
];
const PRIORITY_FILTER_OPTS = [
  { value: '', label: 'Любой' },
  { value: 'HIGH', label: '🔴 Высокий' },
  { value: 'MEDIUM', label: '🟡 Средний' },
  { value: 'LOW', label: '⚪ Низкий' },
];

type GroupBy = 'none' | 'workspace' | 'priority' | 'due';

export default function MyTasksPage() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [duePreset, setDuePreset] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  const fetchTasks = async (filters: { search?: string; priority?: string; duePreset?: string }) => {
    setLoading(true);
    try {
      const data = await tasksApi.listMyTasks({
        ...(filters.search && { search: filters.search }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.duePreset && { duePreset: filters.duePreset }),
      });
      setTasks(data);
    } catch { message.error('Не удалось загрузить задачи'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks({ search, priority, duePreset }); }, []);

  const applyFilters = () => fetchTasks({ search, priority, duePreset });

  const columns: ColumnsType<MyTask> = [
    {
      title: 'Ключ',
      dataIndex: 'issueKey',
      width: 100,
      render: (key: string) => (
        <Text style={{ color: '#4A5578', fontFamily: 'monospace', fontSize: 11 }}>{key}</Text>
      ),
    },
    {
      title: 'Задача',
      dataIndex: 'title',
      render: (title: string, record: MyTask) => (
        <div
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/w/${record.board.workspace.slug}/boards/${record.board.id}`)}
        >
          <Text style={{ color: '#E2E8F8', fontSize: 13 }}>{title}</Text>
          {(record._count?.children ?? 0) > 0 && (
            <span style={{ marginLeft: 8, color: '#4A5578', fontSize: 11 }}>
              <BranchesOutlined /> {record._count?.children}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Доска',
      key: 'board',
      width: 160,
      render: (_: unknown, record: MyTask) => (
        <div>
          <Text style={{ color: '#8B95B0', fontSize: 12 }}>{record.board.workspace.name}</Text>
          <Text style={{ color: '#4A5578', fontSize: 11, display: 'block' }}>{record.board.name}</Text>
        </div>
      ),
    },
    {
      title: 'Статус',
      key: 'status',
      width: 130,
      render: (_: unknown, record: MyTask) => {
        const s = record.status;
        if (!s) return null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <Text style={{ color: '#8B95B0', fontSize: 12 }}>{s.name}</Text>
          </div>
        );
      },
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      width: 120,
      render: (p: string | null) => {
        if (!p) return <Text style={{ color: '#4A5578' }}>—</Text>;
        return (
          <Tag style={{
            background: `${PRIORITY_COLOR[p]}18`,
            border: `1px solid ${PRIORITY_COLOR[p]}44`,
            color: PRIORITY_COLOR[p],
            fontSize: 11,
          }}>
            {PRIORITY_LABEL[p]}
          </Tag>
        );
      },
    },
    {
      title: 'Срок',
      dataIndex: 'dueDate',
      width: 120,
      render: (dueDate: string | null) => {
        if (!dueDate) return <Text style={{ color: '#4A5578' }}>—</Text>;
        const due = new Date(dueDate);
        const isOverdue = due < new Date();
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isOverdue ? '#EF4444' : '#8B95B0', fontSize: 12 }}>
            <CalendarOutlined />
            {due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </span>
        );
      },
    },
  ];

  // Build display list (optionally grouped)
  const groupedSections: { label: string; color?: string; tasks: MyTask[] }[] = (() => {
    if (groupBy === 'workspace') {
      const map = new Map<string, { label: string; tasks: MyTask[] }>();
      for (const t of tasks) {
        const key = t.board.workspace.id;
        if (!map.has(key)) map.set(key, { label: t.board.workspace.name, tasks: [] });
        map.get(key)!.tasks.push(t);
      }
      return Array.from(map.values());
    }
    if (groupBy === 'priority') {
      const order = ['HIGH', 'MEDIUM', 'LOW', '—'];
      const map: Record<string, { label: string; color: string; tasks: MyTask[] }> = {
        HIGH: { label: 'Высокий', color: '#EF4444', tasks: [] },
        MEDIUM: { label: 'Средний', color: '#F59E0B', tasks: [] },
        LOW: { label: 'Низкий', color: '#6B7280', tasks: [] },
        '—': { label: 'Без приоритета', color: '#4A5578', tasks: [] },
      };
      for (const t of tasks) map[t.priority ?? '—'].tasks.push(t);
      return order.map((k) => map[k]).filter((g) => g.tasks.length > 0);
    }
    if (groupBy === 'due') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const groups = [
        { label: 'Просрочено', color: '#EF4444', tasks: [] as MyTask[] },
        { label: 'Сегодня', color: '#4F6EF7', tasks: [] as MyTask[] },
        { label: 'Позже', color: '#8B95B0', tasks: [] as MyTask[] },
        { label: 'Без срока', color: '#4A5578', tasks: [] as MyTask[] },
      ];
      for (const t of tasks) {
        if (!t.dueDate) { groups[3].tasks.push(t); continue; }
        const d = new Date(t.dueDate);
        if (d < today) groups[0].tasks.push(t);
        else if (d < tomorrow) groups[1].tasks.push(t);
        else groups[2].tasks.push(t);
      }
      return groups.filter((g) => g.tasks.length > 0);
    }
    return [{ label: '', tasks }];
  })();

  return (
    <div style={{ minHeight: '100vh', background: '#03050F', padding: '40px 48px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <CheckCircleOutlined style={{ color: '#4F6EF7', fontSize: 22 }} />
          <Title level={2} style={{ margin: 0, color: '#E2E8F8', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
            Мои задачи
          </Title>
          {!loading && (
            <Text style={{ color: '#4A5578', fontSize: 14 }}>({tasks.length})</Text>
          )}
        </div>
        <Text style={{ color: '#4A5578' }}>Все задачи назначенные на вас во всех пространствах</Text>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center',
        padding: '16px', background: '#0F1320', borderRadius: 10, border: '1px solid #1E2640',
      }}>
        <Search
          placeholder="Поиск задач..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={applyFilters}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          value={duePreset}
          onChange={(v) => { setDuePreset(v); }}
          options={DUE_OPTS}
          style={{ width: 160 }}
          placeholder="Срок"
        />
        <Select
          value={priority}
          onChange={(v) => { setPriority(v); }}
          options={PRIORITY_FILTER_OPTS}
          style={{ width: 140 }}
          placeholder="Приоритет"
        />
        <Button type="primary" onClick={applyFilters} style={{ background: '#4F6EF7' }}>
          Применить
        </Button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#4A5578', fontSize: 12 }}>Группировка:</Text>
          <Segmented
            value={groupBy}
            onChange={(v) => setGroupBy(v as GroupBy)}
            options={[
              { value: 'none', label: 'Нет' },
              { value: 'workspace', label: 'Пространство' },
              { value: 'priority', label: 'Приоритет' },
              { value: 'due', label: 'Срок' },
            ]}
            style={{ background: '#161C30' }}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spin size="large" /></div>
      ) : tasks.length === 0 ? (
        <Empty
          description={<Text style={{ color: '#4A5578' }}>Нет задач по выбранным фильтрам</Text>}
          style={{ paddingTop: 80 }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groupedSections.map((section) => (
            <div key={section.label}>
              {groupBy !== 'none' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 10, borderBottom: '1px solid #1E2640', paddingBottom: 8,
                }}>
                  {section.color && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: section.color, flexShrink: 0 }} />
                  )}
                  <Text style={{ color: '#8B95B0', fontWeight: 600, fontSize: 13 }}>{section.label}</Text>
                  <Text style={{ color: '#4A5578', fontSize: 12 }}>({section.tasks.length})</Text>
                </div>
              )}
              <Table<MyTask>
                dataSource={section.tasks}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                style={{ background: '#0F1320', borderRadius: 10, border: '1px solid #1E2640', overflow: 'hidden' }}
                onRow={() => ({
                  style: { background: 'transparent', cursor: 'default' },
                })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
