import qrcode from 'qrcode-generator';
import { fr } from '../i18n/fr';

/**
 * QR code drawn as SVG paths by React (SPEC F8): generated on the device, no external
 * service, no innerHTML. It only ever contains the public URL.
 */
export function QrCode({ value }: { value: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const size = qr.getModuleCount();
  const margin = 4;
  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  const total = size + margin * 2;
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={fr.qr.alt(value)}
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
