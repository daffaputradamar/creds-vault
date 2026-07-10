import { ImageResponse } from 'next/og';

const LIME = '#a3e635';
const DARK = '#0a0e1a';

/**
 * Renders the app icon at a given size: a lime terminal-prompt tile (">_")
 * on a dark field. Shared by the favicon, apple-icon, and manifest icon routes
 * so every surface uses one consistent mark.
 */
export function renderVaultIcon(size: number): ImageResponse {
  const pad = Math.round(size * 0.12);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: DARK,
        }}
      >
        <div
          style={{
            width: size - pad * 2,
            height: size - pad * 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: LIME,
            color: '#000',
            fontSize: size * 0.4,
            fontWeight: 800,
            fontFamily: 'monospace',
            letterSpacing: -size * 0.02,
          }}
        >
          {'>_'}
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
