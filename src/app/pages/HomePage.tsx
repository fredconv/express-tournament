import { useEffect, useState } from 'react';
import { fr } from '../i18n/fr';

type ApiStatus = 'checking' | 'ok' | 'down';

export function HomePage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((res) => setApiStatus(res.ok ? 'ok' : 'down'))
      .catch(() => {
        if (!controller.signal.aborted) setApiStatus('down');
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="page">
      <h1>{fr.appName}</h1>
      <p className="lead">{fr.home.tagline}</p>
      <p className="muted">{fr.home.comingSoon}</p>
      <p className={`status status--${apiStatus}`}>{fr.home.apiStatus[apiStatus]}</p>
    </main>
  );
}
