import { z } from 'zod';
import { registry } from '../registry.js';
import {
  loginDto,
  registerDto,
  updateProfileDto,
  changePasswordDto,
  forgotPasswordDto,
  resetPasswordDto,
} from '../../../modules/auth/auth.dto.js';

const tokenResponse = z.object({
  accessToken: z.string(),
  user: z.object({ id: z.string(), email: z.string(), name: z.string(), isSuperadmin: z.boolean() }),
});

registry.registerPath({
  method: 'post', path: '/auth/login', tags: ['Auth'], summary: 'Вход по email + пароль',
  request: { body: { content: { 'application/json': { schema: loginDto } } } },
  responses: { 200: { description: 'OK + refresh cookie', content: { 'application/json': { schema: tokenResponse } } }, 401: { description: 'Неверные данные' }, 429: { description: 'Brute-force lockout' } },
});

registry.registerPath({
  method: 'post', path: '/auth/register', tags: ['Auth'], summary: 'Создать заявку на регистрацию',
  request: { body: { content: { 'application/json': { schema: registerDto } } } },
  responses: { 201: { description: 'Заявка создана, ожидает одобрения' }, 409: { description: 'Email уже существует' } },
});

registry.registerPath({
  method: 'post', path: '/auth/refresh', tags: ['Auth'], summary: 'Обновить access token',
  responses: { 200: { description: 'Новый accessToken', content: { 'application/json': { schema: tokenResponse } } }, 401: { description: 'Refresh token невалиден' } },
});

registry.registerPath({
  method: 'post', path: '/auth/logout', tags: ['Auth'], summary: 'Выход',
  responses: { 204: { description: 'Сессия завершена' } },
});

registry.registerPath({
  method: 'get', path: '/auth/me', tags: ['Auth'], summary: 'Текущий пользователь',
  responses: { 200: { description: 'Профиль пользователя' }, 401: { description: 'Не авторизован' } },
});

registry.registerPath({
  method: 'patch', path: '/auth/me', tags: ['Auth'], summary: 'Обновить профиль',
  request: { body: { content: { 'application/json': { schema: updateProfileDto } } } },
  responses: { 200: { description: 'Обновлённый профиль' }, 400: { description: 'Ошибка валидации' } },
});

registry.registerPath({
  method: 'post', path: '/auth/change-password', tags: ['Auth'], summary: 'Сменить пароль',
  request: { body: { content: { 'application/json': { schema: changePasswordDto } } } },
  responses: { 204: { description: 'Пароль изменён' }, 400: { description: 'Неверный текущий пароль' } },
});

registry.registerPath({
  method: 'post', path: '/auth/forgot-password', tags: ['Auth'], summary: 'Запросить сброс пароля',
  request: { body: { content: { 'application/json': { schema: forgotPasswordDto } } } },
  responses: { 204: { description: 'Письмо отправлено (если email существует)' } },
});

registry.registerPath({
  method: 'post', path: '/auth/reset-password', tags: ['Auth'], summary: 'Сбросить пароль по токену',
  request: { body: { content: { 'application/json': { schema: resetPasswordDto } } } },
  responses: { 204: { description: 'Пароль сброшен' }, 400: { description: 'Токен невалиден или истёк' } },
});
