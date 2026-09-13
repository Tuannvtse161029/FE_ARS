import { AVATAR_OPTIONS } from './avatarCatalog';

interface AvatarVisualProps {
  url?: string | null;
  initials: string;
  className?: string;
  alt?: string;
  size?: number;
}

/** Renders uploaded avatars and the symbolic Lucide avatars from one source. */
export const AvatarVisual = ({ url, initials, className, alt = '', size = 24 }: AvatarVisualProps) => {
  const symbolicId = url?.startsWith('lucide:') ? url.slice('lucide:'.length) : null;
  const symbolic = symbolicId ? AVATAR_OPTIONS.find((option) => option.id === symbolicId) : null;

  if (symbolic) {
    const Icon = symbolic.icon;
    return (
      <span
        className={className}
        data-avatar-symbolic={symbolic.id}
        aria-label={alt || undefined}
        aria-hidden={alt === '' ? true : undefined}
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: '50%',
          backgroundColor: `color-mix(in srgb, ${symbolic.color} 14%, white)`,
          color: symbolic.color,
        }}
      >
        <Icon
          aria-hidden
          size={Math.round(size * 0.58)}
          style={{ width: Math.round(size * 0.58), height: Math.round(size * 0.58) }}
        />
      </span>
    );
  }

  if (url) {
    return <img src={url} alt={alt} className={className} />;
  }

  return <span className={className} aria-hidden={alt === ''}>{initials}</span>;
};
