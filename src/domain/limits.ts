// Product limits from SPEC.md. Shared by client validation, server validation and the engine.

export const LIMITS = {
  minTeams: 2,
  maxTeams: 32,
  minCourts: 1,
  maxCourts: 6,
  teamNameMax: 40,
  courtNameMax: 30,
  tournamentNameMax: 80,
  locationMax: 80,
  minSets: 1,
  maxSets: 5,
  minMinutesPerSet: 1,
  maxMinutesPerSet: 60,
  minPointsPerSet: 5,
  maxPointsPerSet: 50,
  minSlotMinutes: 5,
  maxSlotMinutes: 240,
  maxTransitionMinutes: 30,
} as const;
