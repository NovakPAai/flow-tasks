import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import api from '../api/client';
import { formatApiError } from '../utils/apiError';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { password: string }) => {
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      message.success('Пароль изменён. Войдите с новым паролем.');
      navigate('/login');
    } catch (err) {
      message.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ color: 'var(--error-10)' }}>Неверная ссылка для сброса пароля.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--static-background-base)' }}>
      <div style={{ background: 'var(--neutral-0)', padding: 32, borderRadius: 8, width: 360, boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ marginBottom: 24 }}>Новый пароль</h2>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="password"
            label="Новый пароль"
            rules={[
              { required: true, message: 'Введите пароль' },
              { min: 8, message: 'Минимум 8 символов' },
              { pattern: /[A-Z]/, message: 'Нужна хотя бы одна заглавная буква' },
              { pattern: /\d/, message: 'Нужна хотя бы одна цифра' },
            ]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Повторите пароль"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Повторите пароль' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('Пароли не совпадают'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Сохранить пароль
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
