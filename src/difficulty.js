export const TARGET_WIN_RATE = 0.2;

const BASE_CHALLENGE = [1.2, 1.17, 1.15, 1.17, 1.14, 1.05];
const HISTORY_LIMIT = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function emptyArenaRecord() {
  return { attempts: 0, wins: 0, recent: [] };
}

export function normalizeArenaRecords(value, arenaCount) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: arenaCount }, (_, index) => {
    const record = source[index] || {};
    const attempts = Math.max(0, Math.floor(Number(record.attempts) || 0));
    const wins = clamp(Math.floor(Number(record.wins) || 0), 0, attempts);
    const recent = Array.isArray(record.recent)
      ? record.recent.slice(-HISTORY_LIMIT).map((result) => Boolean(result))
      : [];
    return { attempts, wins, recent };
  });
}

export function estimatedWinRate(record = emptyArenaRecord()) {
  const recent = Array.isArray(record.recent) ? record.recent : [];
  const recentWins = recent.reduce((total, won) => total + (won ? 1 : 0), 0);
  // A 2/10 Bayesian prior starts new arenas at the target and avoids reacting
  // too sharply to a single result while still adapting within a short session.
  return (recentWins + 2) / (recent.length + 10);
}

export function challengeForArena(arenaIndex, record) {
  const base = BASE_CHALLENGE[arenaIndex] ?? BASE_CHALLENGE[BASE_CHALLENGE.length - 1];
  const delta = estimatedWinRate(record) - TARGET_WIN_RATE;
  const response = delta >= 0 ? delta * 1.15 : delta * 1.8;
  return Number(clamp(base + response, 0.92, 1.55).toFixed(3));
}

export function recordArenaResult(records, arenaIndex, won) {
  const next = records.map((record) => ({ ...record, recent: [...record.recent] }));
  const record = next[arenaIndex] || emptyArenaRecord();
  record.attempts += 1;
  record.wins += won ? 1 : 0;
  record.recent = [...record.recent, Boolean(won)].slice(-HISTORY_LIMIT);
  next[arenaIndex] = record;
  return next;
}
