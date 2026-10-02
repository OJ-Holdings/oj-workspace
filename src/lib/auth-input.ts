export const invitationTokenPattern = /^[a-f0-9]{64}$/;
export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function safeAuthNext(value: string | null) {
  if (value === '/auth/password' || value === '/setup') return value;
  if (value && /^\/join\/[a-f0-9]{64}$/.test(value)) return value;
  return '/workspace';
}
export function passwordError(password: string, confirmation: string) {
  if (password.length < 12 || password.length > 128) return 'Choose a password with 12 to 128 characters.';
  if (password !== confirmation) return 'The passwords do not match.';
  return '';
}
