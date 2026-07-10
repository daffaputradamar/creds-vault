import { renderVaultIcon } from '@/lib/vault-icon';

export const dynamic = 'force-static';

export function GET() {
  return renderVaultIcon(512);
}
