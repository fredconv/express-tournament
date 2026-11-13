import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { QrCode } from '../components/QrCode';
import { fr } from '../i18n/fr';

/** Full-screen QR code to show to participants (SPEC F8). */
export function QrPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/t/${id}`;
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="qr-page">
      <h1 className="qr-page__title">{fr.qr.title}</h1>
      <QrCode value={url} />
      <Link className="qr-page__url" to={`/t/${id}`}>
        {url}
      </Link>
      <div className="qr-page__actions">
        <button type="button" className="button" onClick={() => void copy()}>
          {copied ? fr.qr.copied : fr.qr.copy}
        </button>
        {canShare && (
          <button
            type="button"
            className="button"
            onClick={() => void navigator.share({ url }).catch(() => undefined)}
          >
            {fr.qr.share}
          </button>
        )}
        <button type="button" className="button button--ghost" onClick={() => navigate(-1)}>
          {fr.qr.back}
        </button>
      </div>
    </main>
  );
}
