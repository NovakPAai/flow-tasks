import type { AxiosError } from 'axios';

interface ZodIssue {
  message: string;
  path?: (string | number)[];
}

interface ApiErrorBody {
  message?: string;
  details?: ZodIssue[];
  error?: string;
}

export interface ParsedApiError {
  title: string;
  description?: string;
}

export function parseApiError(err: unknown): ParsedApiError {
  const axiosErr = err as AxiosError<ApiErrorBody>;
  const data = axiosErr?.response?.data;

  if (!data) {
    return { title: 'Нет соединения с сервером. Проверьте сеть.' };
  }

  // Zod validation errors — array of field errors
  if (data.details && Array.isArray(data.details) && data.details.length > 0) {
    const msgs = data.details.map((d) => d.message).join('; ');
    return { title: 'Ошибка валидации', description: msgs };
  }

  if (data.message) {
    return { title: data.message };
  }

  if (data.error) {
    return { title: data.error };
  }

  const status = axiosErr?.response?.status;
  switch (status) {
    case 400: return { title: 'Неверный запрос. Проверьте введённые данные.' };
    case 401: return { title: 'Сессия истекла. Войдите снова.' };
    case 403: return { title: 'Нет доступа к этому ресурсу.' };
    case 404: return { title: 'Ресурс не найден.' };
    case 409: return { title: 'Конфликт: такая запись уже существует.' };
    case 422: return { title: 'Данные не прошли проверку. Исправьте форму.' };
    case 429: return { title: 'Слишком много запросов. Подождите немного.' };
    case 503: return { title: 'Сервис временно недоступен. Попробуйте позже.' };
    default: return { title: 'Что-то пошло не так. Попробуйте ещё раз.' };
  }
}

export function formatApiError(err: unknown): string {
  const { title, description } = parseApiError(err);
  return description ? `${title}: ${description}` : title;
}
