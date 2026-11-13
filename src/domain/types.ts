// Shared domain types. The scheduling engine only depends on these, never on Zod.

export type MatchFormat =
  | {
      kind: 'time';
      /** Number of sets played. */
      setCount: number;
      minutesPerSet: number;
    }
  | {
      kind: 'points';
      /** Maximum number of sets played (for best-of, e.g. 3 for "2 winning sets"). */
      setCount: number;
      pointsPerSet: number;
      mode: 'all-sets' | 'best-of';
      /** Points of the last (deciding) set, when different. */
      decidingSetPoints?: number | undefined;
    };

export interface ScheduleInput {
  /** Team ids in entry order. */
  teamIds: readonly string[];
  /** Court ids in display order. */
  courtIds: readonly string[];
  startMinute: number;
  slotMinutes: number;
  transitionMinutes: number;
  avoidBackToBack: boolean;
  targetEndMinute?: number;
}

export interface PoolInput {
  id: string;
  teamIds: readonly string[];
}

/** Several pools played at the same time on shared courts (SPEC F4). */
export interface PoolScheduleInput extends Omit<ScheduleInput, 'teamIds'> {
  pools: readonly PoolInput[];
  /** Match ids are `${idPrefix}${number}`; default "m". */
  idPrefix?: string;
  /** Number of the first match, so numbering continues across phases; default 1. */
  firstNumber?: number;
}

export interface ScheduledMatch {
  id: string;
  poolId: string;
  /** 1-based number shown to players, chronological then by court. */
  number: number;
  /** 0-based time slot index. */
  slot: number;
  courtId: string;
  teamAId: string;
  teamBId: string;
  startMinute: number;
  endMinute: number;
}

export type ScheduleWarning =
  | { kind: 'back-to-back'; slot: number; teamIds: string[] }
  | { kind: 'exceeds-target-end'; endMinute: number }
  | { kind: 'past-midnight'; endMinute: number };

export interface ScheduleResult {
  matches: ScheduledMatch[];
  slotCount: number;
  /** End of the last match (start of the tournament if there is no match). */
  endMinute: number;
  warnings: ScheduleWarning[];
  /**
   * True when the number of back-to-backs is proven minimal for this day length;
   * false means "best schedule found", not "unavoidable".
   */
  backToBackMinimal: boolean;
}
