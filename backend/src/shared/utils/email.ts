import nodemailer from 'nodemailer';
import { config } from '../../config.js';
import { logger } from './logger.js';

function isConfigured(): boolean {
  return Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  if (!isConfigured()) {
    logger.warn('email_not_configured', { action: 'password_reset' });
    return;
  }

  const resetUrl = `${config.APP_URL}/reset-password?token=${token}`;
  const transport = createTransport();

  await transport.sendMail({
    from: `"FlowTask" <${config.SMTP_FROM}>`,
    to,
    subject: 'Сброс пароля FlowTask',
    text: [
      'Вы запросили сброс пароля.',
      '',
      `Перейдите по ссылке для создания нового пароля (действительна 1 час):`,
      resetUrl,
      '',
      'Если вы не запрашивали сброс пароля — проигнорируйте это письмо.',
    ].join('\n'),
    html: [
      '<p>Вы запросили сброс пароля.</p>',
      '<p>Перейдите по ссылке для создания нового пароля (действительна&nbsp;1&nbsp;час):</p>',
      `<p><a href="${resetUrl}">${resetUrl}</a></p>`,
      '<p style="color:#888">Если вы не запрашивали сброс пароля — проигнорируйте это письмо.</p>',
    ].join(''),
  });

  logger.info('email_sent', { action: 'password_reset' });
}
