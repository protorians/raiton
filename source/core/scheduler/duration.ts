/**
 * Parses human-readable durations into milliseconds.
 *
 * Accepts a bare number (already milliseconds) or a string made of one or more
 * `<value><unit>` groups such as `"5s"`, `"1m30s"`, `"2 hours"` or `"500ms"`.
 */

const UNITS: Record<string, number> = {
    ms: 1, millisecond: 1, milliseconds: 1,
    s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
    m: 60_000, min: 60_000, mins: 60_000, minute: 60_000, minutes: 60_000,
    h: 3_600_000, hr: 3_600_000, hrs: 3_600_000, hour: 3_600_000, hours: 3_600_000,
    d: 86_400_000, day: 86_400_000, days: 86_400_000,
    w: 604_800_000, week: 604_800_000, weeks: 604_800_000,
};

const GROUP = /(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|weeks?)/gi;

export function parseDuration(value: number | string): number {
    if (typeof value === 'number') return Math.max(0, value);
    if (typeof value !== 'string') return 0;

    const trimmed = value.trim();
    if (trimmed === '') return 0;
    if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.max(0, Number(trimmed));

    let total = 0;
    let matched = false;

    for (const match of trimmed.matchAll(GROUP)) {
        const amount = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        total += amount * UNITS[unit];
        matched = true;
    }

    if (!matched) {
        throw new Error(`Invalid duration "${value}".`);
    }

    return Math.max(0, Math.round(total));
}
