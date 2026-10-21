// Rules from the original module 1735.
export const MIN_PASSWORD_LENGTH = 8;
export const RESET_CODE_LENGTH = 6;
export const RESEND_SECONDS = 60;

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const isValidPassword = (value: string) => value.length >= MIN_PASSWORD_LENGTH;

export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!domain || !name) return email;
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(name.length - 1, 1))}@${domain}`;
}
