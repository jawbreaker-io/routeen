import { getPlaceTypeMeta } from '../constants/placeTypes';

/**
 * Candy place-type disc: a solid type-coloured disc with a white Phosphor glyph
 * (or custom children, e.g. a stop number). Used in the sidebar timeline, saved
 * places tray, map popups and the analytics dashboard.
 *
 * shadow:
 *   'ring' — white keyline + soft colour halo (timeline stops)
 *   'soft' — soft coloured drop shadow (saved places, popup, grid)
 *   'none' — flat (leaderboard / compact rows)
 */
export default function TypeDisc({
  type,
  size = 34,
  radius = '50%',
  iconSize = 17,
  shadow = 'soft',
  children,
  style,
}) {
  const meta = getPlaceTypeMeta(type);
  const Icon = meta.Icon;

  const shadowValue =
    shadow === 'ring'
      ? `0 0 0 2px #fff, 0 0 0 3.5px ${meta.color}55`
      : shadow === 'soft'
        ? `0 3px 8px ${meta.color}40`
        : 'none';

  return (
    <span
      className="type-disc"
      style={{
        width: size,
        height: size,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
        background: meta.color,
        boxShadow: shadowValue,
        ...style,
      }}
    >
      {children != null ? children : <Icon size={iconSize} weight="fill" />}
    </span>
  );
}
