import { Link } from 'react-router';
import { fr } from '../i18n/fr';

export function NotFoundPage() {
  return (
    <main className="page">
      <h1>{fr.notFound.title}</h1>
      <p>
        <Link to="/">{fr.notFound.backHome}</Link>
      </p>
    </main>
  );
}
