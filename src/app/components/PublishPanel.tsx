import { useState } from 'react';
import { Link } from 'react-router';
import { type ApiError, createTournament, updateTournament } from '../../client/api';
import { deviceStore } from '../../client/storage';
import type { Draft } from '../draft/model';
import { docKey, publishIssue, toDoc } from '../draft/publish';
import { fr } from '../i18n/fr';
import type { StepProps } from './stepProps';

/** Publish or update the public page (SPEC F9). The management code stays on the device. */
export function PublishPanel({ draft, update }: StepProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const issue = publishIssue(draft);
  const publication = draft.publication;
  const pending = publication !== null && docKey(draft) !== publication.key;

  const publish = async () => {
    setBusy(true);
    setError(null);
    const result = await send(draft);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    update((d) => ({ ...d, publication: result.publication }));
  };

  return (
    <section className="publish no-print">
      {issue && !publication && <p className="muted small">{fr.publish.issue[issue]}</p>}
      {publication && (
        <p className={pending ? 'notice notice--warning' : 'muted small'}>
          {pending ? fr.publish.pending : fr.publish.upToDate}
        </p>
      )}
      {(!publication || pending) && (
        <button
          type="button"
          className="button button--primary button--block"
          disabled={issue !== null || busy}
          onClick={publish}
        >
          {busy ? fr.publish.publishing : publication ? fr.publish.update : fr.publish.publish}
        </button>
      )}
      {issue && publication && <p className="muted small">{fr.publish.issue[issue]}</p>}
      {error && <p className="notice notice--warning">{fr.publish.error[error]}</p>}
      {publication && (
        <div className="publish__links">
          <Link className="button" to={`/t/${publication.id}/qr`}>
            {fr.publish.showQr}
          </Link>
          <Link className="button" to={`/t/${publication.id}`}>
            {fr.publish.viewPublic}
          </Link>
        </div>
      )}
    </section>
  );
}

type SendResult =
  | { ok: true; publication: NonNullable<Draft['publication']> }
  | { ok: false; error: ApiError };

async function send(draft: Draft): Promise<SendResult> {
  const doc = toDoc(draft);
  const key = JSON.stringify(doc);
  const current = draft.publication;
  if (!current) {
    const created = await createTournament(doc);
    if (!created.ok) return created;
    deviceStore.saveOwnerCode(created.value.id, created.value.ownerToken);
    return { ok: true, publication: { id: created.value.id, version: created.value.version, key } };
  }
  const code = deviceStore.ownerCode(current.id);
  if (!code) return { ok: false, error: 'unauthorized' };
  const updated = await updateTournament(current.id, code, current.version, doc);
  if (!updated.ok) return updated;
  return { ok: true, publication: { id: current.id, version: updated.value.version, key } };
}
