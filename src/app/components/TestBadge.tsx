import { fr } from '../i18n/fr';

/** Marks a test tournament (SPEC F15) in text, not only with color. */
export function TestBadge() {
  return (
    <span className="test-badge" title={fr.test.badgeLabel}>
      {fr.test.badge}
    </span>
  );
}
