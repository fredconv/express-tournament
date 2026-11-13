// Court colors (SPEC F13): dark tones so that white text on a badge keeps a WCAG AA
// contrast; the court name is always written, color is never the only signal.

export const COURT_PALETTE = [
  '#1864ab', // blue
  '#6f42c1', // violet
  '#18794e', // green
  '#0b7285', // teal
  '#a61e4d', // raspberry
  '#6b4f1d', // brown
] as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/;

export function isCourtColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function defaultCourtColor(index: number): string {
  return COURT_PALETTE[index % COURT_PALETTE.length] as string;
}

/** Stored color, or the palette color of the court's position. */
export function courtColor(court: { color?: string | undefined }, index: number): string {
  return court.color && isCourtColor(court.color) ? court.color : defaultCourtColor(index);
}

/** Black or white, whichever contrasts most with the background (WCAG relative luminance). */
export function textColorOn(background: string): '#000000' | '#ffffff' {
  const luminance = relativeLuminance(background);
  const withWhite = 1.05 / (luminance + 0.05);
  const withBlack = (luminance + 0.05) / 0.05;
  return withWhite >= withBlack ? '#ffffff' : '#000000';
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((light as number) + 0.05) / ((dark as number) + 0.05);
}

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
