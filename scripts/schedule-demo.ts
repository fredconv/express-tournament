// Prints a schedule in the console, without React or a browser (ROADMAP E1 DoD).
// Usage: npm run schedule:demo -- <teams> <courts> [--no-rest]
import { generateSchedule } from '../src/domain/schedule/generate';
import { formatTime, parseTime } from '../src/domain/time';

const [teamsArg = '8', courtsArg = '2'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const avoidBackToBack = !process.argv.includes('--no-rest');
const teamCount = Number(teamsArg);
const courtCount = Number(courtsArg);

const teamIds = Array.from({ length: teamCount }, (_, i) => `T${i + 1}`);
const courtIds = Array.from({ length: courtCount }, (_, i) => `C${i + 1}`);

const result = generateSchedule({
  teamIds,
  courtIds,
  startMinute: parseTime('09:00'),
  slotMinutes: 20,
  transitionMinutes: 5,
  avoidBackToBack,
});

const pad = (value: string, width: number) => value.padEnd(width);
console.log(
  `${teamCount} équipes, ${courtCount} terrain(s), repos ${avoidBackToBack ? 'activé' : 'désactivé'}`,
);
console.log(
  `${result.matches.length} matchs, ${result.slotCount} créneaux, fin ${formatTime(result.endMinute)}\n`,
);

for (let slot = 0; slot < result.slotCount; slot++) {
  const matches = result.matches.filter((m) => m.slot === slot);
  const time = formatTime(matches[0]?.startMinute ?? 0);
  const line = matches
    .map((m) => `${m.courtId}: ${pad(`${m.teamAId}-${m.teamBId}`, 8)} (#${m.number})`)
    .join('   ');
  console.log(`${time}  ${line}`);
}

const backToBack = result.warnings.filter((w) => w.kind === 'back-to-back');
if (backToBack.length > 0) {
  console.log('\nMatchs consécutifs :');
  for (const w of backToBack) {
    if (w.kind === 'back-to-back') console.log(`  créneau ${w.slot + 1} : ${w.teamIds.join(', ')}`);
  }
}
