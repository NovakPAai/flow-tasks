import { Modal, Button } from 'antd';

interface Props {
  open: boolean;
  countdown: number;
  onStay: () => void;
  onLogout: () => void;
}

function pluralSeconds(n: number): string {
  const last2 = n % 100;
  const last1 = n % 10;
  if (last2 >= 11 && last2 <= 14) return 'секунд';
  if (last1 === 1) return 'секунда';
  if (last1 >= 2 && last1 <= 4) return 'секунды';
  return 'секунд';
}

export default function SessionTimeoutModal({ open, countdown, onStay, onLogout }: Props) {
  return (
    <Modal
      open={open}
      title="Время сессии истекает"
      closable={false}
      maskClosable={false}
      keyboard={false}
      width={400}
      footer={[
        <Button key="logout" onClick={onLogout}>
          Выйти
        </Button>,
        <Button key="stay" type="primary" onClick={onStay} autoFocus>
          Остаться
        </Button>,
      ]}
    >
      <p style={{ margin: '8px 0 0', lineHeight: '22px' }}>
        Вы были неактивны. Сессия завершится через{' '}
        <strong>{countdown}</strong>{' '}
        {pluralSeconds(countdown)}.
      </p>
      <p style={{ margin: '8px 0 0', lineHeight: '22px', opacity: 0.7, fontSize: 13 }}>
        Нажмите «Остаться», чтобы продолжить работу.
      </p>
    </Modal>
  );
}
