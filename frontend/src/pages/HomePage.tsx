import { Button, Typography } from 'antd';
import { useAuthStore } from '../store/auth.store';

const { Title, Text } = Typography;

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div style={{ padding: 40, background: '#03050F', minHeight: '100vh', color: '#E2E8F8' }}>
      <Title level={2} style={{ color: '#E2E8F8', fontFamily: 'Space Grotesk' }}>
        FlowTask
      </Title>
      <Text style={{ color: '#8B95B0', display: 'block', marginBottom: 24 }}>
        Добро пожаловать, {user?.name ?? 'пользователь'}!
      </Text>
      <Button onClick={logout}>Выйти</Button>
    </div>
  );
}
