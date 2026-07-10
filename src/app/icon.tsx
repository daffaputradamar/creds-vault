import { renderVaultIcon } from '@/lib/vault-icon';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return renderVaultIcon(64);
}
