import { useRef, useState } from 'react';
import { Modal, Form, Input, Radio, Button, message } from 'antd';
import api from '../api/client';
import { formatApiError } from '../utils/apiError';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function collectDeviceMeta() {
    const ua = navigator.userAgent;

    const deviceType =
      /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' :
      /iPad|Tablet/i.test(ua) ? 'tablet' : 'desktop';

    let os = 'Unknown';
    if      (/Windows/i.test(ua))                          os = 'Windows';
    else if (/Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) os = 'macOS';
    else if (/iPhone/i.test(ua))                           os = 'iOS';
    else if (/iPad/i.test(ua))                             os = 'iPadOS';
    else if (/Android/i.test(ua))                          os = 'Android';
    else if (/Linux/i.test(ua))                            os = 'Linux';

    let browser = 'Unknown';
    if      (/Edg\//i.test(ua))     browser = 'Edge';
    else if (/OPR\//i.test(ua))     browser = 'Opera';
    else if (/YaBrowser/i.test(ua)) browser = 'Yandex';
    else if (/Chrome\//i.test(ua))  browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua))  browser = 'Safari';

    return {
      ua,
      screen: `${screen.width}×${screen.height}`,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      url: window.location.href,
      language: navigator.language,
      deviceType,
      os,
      browser,
    };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!SCREENSHOT_ALLOWED.includes(file.type)) {
      message.error('Допустимые форматы: PNG, JPG, WEBP, GIF');
      return;
    }
    if (file.size > SCREENSHOT_MAX_BYTES) {
      message.error('Файл не должен превышать 5 МБ');
      return;
    }
    setScreenshot(file);
    setPreview(URL.createObjectURL(file));
  }

  function removeScreenshot() {
    setScreenshot(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    form.resetFields();
    removeScreenshot();
    onClose();
  }

  const onFinish = async (values: { title: string; body: string; type: 'bug' | 'idea' }) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('body', values.body);
      formData.append('type', values.type);
      formData.append('meta', JSON.stringify(collectDeviceMeta()));
      if (screenshot) formData.append('screenshot', screenshot);

      const res = await api.post<{ url: string; number: number }>('/feedback', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(
        <span>
          Обращение #{res.data.number} создано.{' '}
          <a href={res.data.url} target="_blank" rel="noreferrer">Открыть →</a>
        </span>,
        5,
      );
      handleClose();
    } catch (err) {
      message.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
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

        <Form.Item label="Скриншот (необязательно)">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {preview ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={preview} alt="Скриншот" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 6, border: '1px solid #d9d9d9', display: 'block' }} />
              <button
                type="button"
                onClick={removeScreenshot}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Удалить скриншот"
              >
                ✕
              </button>
            </div>
          ) : (
            <Button type="dashed" onClick={() => fileInputRef.current?.click()} block>
              Прикрепить скриншот
            </Button>
          )}
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
