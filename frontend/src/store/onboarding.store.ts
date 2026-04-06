import { create } from 'zustand';

const TOTAL_STEPS = 5;

export const ONBOARDING_STEPS = [
  {
    target: '[data-onboarding="create-workspace"]',
    title: 'Создайте первое пространство',
    message: 'Workspace — это отдельная среда для вашей команды. Нажмите карточку «Новое пространство», чтобы начать.',
  },
  {
    target: '[data-onboarding="create-board"]',
    title: 'Создайте первую доску',
    message: 'Доска — это пространство для задач вашей команды. Нажмите «+ Создать доску», задайте название и выберите workflow.',
  },
  {
    target: '[data-onboarding="create-task"]',
    title: 'Добавьте первую задачу',
    message: 'Нажмите «+ Создать задачу» или «+» в любой колонке доски, введите название и нажмите Enter.',
  },
  {
    target: '[data-onboarding="ws-members"]',
    title: 'Пригласите коллег',
    message: 'Добавьте участников в workspace — введите email и назначьте роль. Команда сразу получит доступ к доскам.',
  },
  {
    target: '[data-onboarding="ws-workflows"]',
    title: 'Настройте workflow',
    message: 'Настройте статусы и переходы задач под ваш процесс: Kanban, Scrum или кастомный флоу.',
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
