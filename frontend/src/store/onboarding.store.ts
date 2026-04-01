import { create } from 'zustand';

const TOTAL_STEPS = 5;

export const ONBOARDING_STEPS = [
  {
    message: 'Создайте ваше первое рабочее пространство — это отправная точка для совместной работы.',
    hint: 'Нажмите «Создать workspace»',
  },
  {
    message: 'Добавьте доску для задач вашей команды — Kanban, список или календарь.',
    hint: 'Нажмите «Создать доску»',
  },
  {
    message: 'Создайте первую задачу — нажмите «+» в любой колонке.',
    hint: 'Кликните по колонке',
  },
  {
    message: 'Пригласите коллег — добавьте участников в workspace.',
    hint: 'Откройте Настройки → Участники',
  },
  {
    message: 'Настройте workflow под вашу команду: статусы, переходы, режим.',
    hint: 'Откройте Настройки → Workflows',
  },
];

interface OnboardingState {
  active: boolean;
  step: number;
  dismissed: boolean;
  userId: string | null;
  init: (userId: string, loginCount: number) => void;
  nextStep: () => void;
  skipAll: () => void;
}

function storageKey(userId: string) {
  return `onboarding_dismissed_${userId}`;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  active: false,
  step: 0,
  dismissed: false,
  userId: null,

  init: (userId: string, loginCount: number) => {
    const dismissed = localStorage.getItem(storageKey(userId)) === 'true';
    const shouldShow = loginCount <= 5 && !dismissed;
    set({ userId, active: shouldShow, dismissed, step: 0 });
  },

  nextStep: () => {
    const { step, userId } = get();
    const next = step + 1;
    if (next >= TOTAL_STEPS) {
      if (userId) localStorage.setItem(storageKey(userId), 'true');
      set({ active: false, dismissed: true });
    } else {
      set({ step: next });
    }
  },

  skipAll: () => {
    const { userId } = get();
    if (userId) localStorage.setItem(storageKey(userId), 'true');
    set({ active: false, dismissed: true });
  },
}));
