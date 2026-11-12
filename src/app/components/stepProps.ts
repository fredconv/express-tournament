import type { Draft } from '../draft/model';

export interface StepProps {
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
}
