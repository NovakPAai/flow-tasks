import { useState } from 'react';
import { Modal, Form, Input, Radio, Button, message } from 'antd';
import api from '../api/client';
import { formatApiError } from '../utils/apiError';
import { useBreakpoint } from '../utils/useBreakpoint';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const tier = useBreakpoint();

  const onFinish = async (values: { title: string; body: string; type: 'bug' | 'idea' }) => {
    setLoading(true);
    try {
      const device = {
        tier,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        userAgent: navigator.userAgent.slice(0, 500),
      };
      const res = await api.post<{ url: string; number: number }>('/feedback', { ...values, device });
      message.success(
        <span>
          Обращение #{res.data.number} создано.{' '}
          <a href={res.data.url} target="_blank" rel="noreferrer">Открыть →</a>
        </span>,
        5,
      );
      form.resetFields();
      onClose();
    } catch (err) {
      message.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      footer={null}
      title="Обратная связь"
      width={480}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ type: 'bug' }}>
        <Form.Item name="type" label="Тип">
          <Radio.Group>
            <Radio.Button value="bug">Баг</Radio.Button>
            <Radio.Button value="idea">Идея</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="title" label="Заголовок" rules={[{ required: true, message: 'Введите заголовок' }, { min: 3, message: 'Минимум 3 символа' }]}>
          <Input placeholder="Кратко опишите проблему или идею" />
        </Form.Item>
        <Form.Item name="body" label="Описание" rules={[{ required: true, message: 'Введите описание' }, { min: 10, message: 'Минимум 10 символов' }]}>
          <Input.TextArea rows={4} placeholder="Подробное описание..." />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Отправить
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
