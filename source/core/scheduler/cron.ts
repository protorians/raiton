/**
 * Pure cron expression parser and next-run engine. No external dependency.
 *
 * Supports the classic 5-field (`minute hour day-of-month month day-of-week`)
 * and extended 6-field (`second minute hour day-of-month month day-of-week`)
 * formats, plus named values, lists, ranges, steps and the standard macros.
 *
 * Day-of-month / day-of-week follow Vixie-cron semantics: when both fields are
 * restricted (not `*` / `?`), a day matches when *either* field matches.
 */

export interface CronFieldRange {
    min: number;
    max: number;
}

export interface CronScheduleInterface {
    readonly expression: string;
    readonly timezone?: string;

    next(from?: Date): Date | null;

    nextN(count: number, from?: Date): Date[];

    matches(date: Date): boolean;
}

interface TimeParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dayOfWeek: number;
}

interface Field {
    allowed: boolean[];
    wildcard: boolean;
    values: number[];
}

interface ParsedFields {
    seconds: Field;
    minutes: Field;
    hours: Field;
    daysOfMonth: Field;
    months: Field;
    daysOfWeek: Field;
}

const MONTH_NAMES: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const DOW_NAMES: Record<string, number> = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

const MACROS: Record<string, string> = {
    '@yearly': '0 0 1 1 *',
    '@annually': '0 0 1 1 *',
    '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *',
    '@midnight': '0 0 * * *',
    '@hourly': '0 * * * *',
    '@minutely': '0 * * * * *',
    '@secondly': '* * * * * *',
};

const MAX_ITERATIONS = 100_000;

export function parseCron(expression: string, timezone?: string): CronScheduleInterface {
    return new CronSchedule(expression, timezone);
}

export class CronSchedule implements CronScheduleInterface {
    readonly expression: string;
    readonly timezone?: string;
    private readonly fields: ParsedFields;

    constructor(expression: string, timezone?: string) {
        const normalized = (MACROS[expression.trim().toLowerCase()] || expression).trim();
        this.expression = normalized;
        this.timezone = timezone;
        this.fields = this.parse(normalized);
    }

    next(from: Date = new Date()): Date | null {
        const tz = this.timezone;
        let p = zonedParts(from, tz);
        p.second += 1;
        if (p.second > 59) {
            p.second = 0;
            bumpMinute(p);
        }

        const f = this.fields;

        for (let i = 0; i < MAX_ITERATIONS; i++) {
            if (!f.months.allowed[p.month]) {
                const next = nextAllowed(f.months.values, p.month);
                if (next === null || next <= p.month) {
                    p.year += 1;
                    p.month = f.months.values[0];
                } else {
                    p.month = next;
                }
                p.day = 1;
                p.hour = 0;
                p.minute = 0;
                p.second = 0;
                continue;
            }

            if (!dayMatches(p, f)) {
                bumpDay(p);
                p.hour = 0;
                p.minute = 0;
                p.second = 0;
                continue;
            }

            if (!f.hours.allowed[p.hour]) {
                const next = nextAllowed(f.hours.values, p.hour);
                if (next === null || next <= p.hour) {
                    bumpDay(p);
                    p.hour = f.hours.values[0];
                } else {
                    p.hour = next;
                }
                p.minute = 0;
                p.second = 0;
                continue;
            }

            if (!f.minutes.allowed[p.minute]) {
                const next = nextAllowed(f.minutes.values, p.minute);
                if (next === null || next <= p.minute) {
                    bumpHour(p);
                    p.minute = f.minutes.values[0];
                } else {
                    p.minute = next;
                }
                p.second = 0;
                continue;
            }

            if (!f.seconds.allowed[p.second]) {
                const next = nextAllowed(f.seconds.values, p.second);
                if (next === null || next <= p.second) {
                    bumpMinute(p);
                    p.second = f.seconds.values[0];
                } else {
                    p.second = next;
                }
                continue;
            }

            return fromZoned(p, tz);
        }

        return null;
    }

    nextN(count: number, from: Date = new Date()): Date[] {
        const results: Date[] = [];
        let cursor = from;
        for (let i = 0; i < count; i++) {
            const next = this.next(cursor);
            if (next === null) break;
            results.push(next);
            cursor = next;
        }
        return results;
    }

    matches(date: Date): boolean {
        const p = zonedParts(date, this.timezone);
        const f = this.fields;
        return f.seconds.allowed[p.second]
            && f.minutes.allowed[p.minute]
            && f.hours.allowed[p.hour]
            && f.months.allowed[p.month]
            && dayMatches(p, f);
    }

    private parse(expression: string): ParsedFields {
        const tokens = expression.trim().split(/\s+/);
        if (tokens.length === 5) {
            tokens.unshift('0');
        }
        if (tokens.length !== 6) {
            throw new Error(`Invalid cron expression "${expression}": expected 5 or 6 fields.`);
        }

        const [second, minute, hour, dom, month, dow] = tokens;
        return {
            seconds: parseField(second, 0, 59),
            minutes: parseField(minute, 0, 59),
            hours: parseField(hour, 0, 23),
            daysOfMonth: parseField(dom, 1, 31),
            months: parseField(month, 1, 12, MONTH_NAMES),
            daysOfWeek: parseField(dow, 0, 7, DOW_NAMES),
        };
    }
}

function parseField(token: string, min: number, max: number, names?: Record<string, number>): Field {
    const allowed: boolean[] = new Array(max + 1).fill(false);
    const valueSet = new Set<number>();
    let wildcard = false;

    const upper = token.toUpperCase();

    for (const rawPart of upper.split(',')) {
        const part = rawPart.trim();
        if (part === '' ) continue;

        if (part === '*' || part === '?') {
            wildcard = true;
            for (let v = min; v <= max; v++) valueSet.add(v);
            continue;
        }

        let step = 1;
        let body = part;
        const slashIndex = part.indexOf('/');
        if (slashIndex !== -1) {
            body = part.slice(0, slashIndex);
            step = parseInt(part.slice(slashIndex + 1), 10);
            if (isNaN(step) || step <= 0) {
                throw new Error(`Invalid step in cron field "${token}".`);
            }
        }

        let lo = min;
        let hi = max;

        if (body === '*' || body === '?') {
            lo = min;
            hi = max;
        } else {
            const dashIndex = body.indexOf('-');
            if (dashIndex !== -1) {
                lo = resolveValue(body.slice(0, dashIndex), min, max, names);
                hi = resolveValue(body.slice(dashIndex + 1), min, max, names);
            } else {
                lo = resolveValue(body, min, max, names);
                hi = lo;
            }
        }

        if (lo > hi) {
            throw new Error(`Invalid range in cron field "${token}".`);
        }

        for (let v = lo; v <= hi; v += step) {
            valueSet.add(v);
        }
    }

    for (const v of valueSet) {
        if (v >= min && v <= max) allowed[v] = true;
    }

    const values = Array.from(valueSet).filter(v => v >= min && v <= max).sort((a, b) => a - b);

    return {allowed, wildcard, values};
}

function resolveValue(raw: string, min: number, max: number, names?: Record<string, number>): number {
    const token = raw.trim().toUpperCase();
    if (names && token in names) {
        const v = names[token];
        if (v < min || v > max) {
            throw new Error(`Named value "${raw}" out of range.`);
        }
        return v;
    }
    const n = parseInt(token, 10);
    if (isNaN(n) || n < min || n > max) {
        throw new Error(`Cron field value "${raw}" out of range [${min}, ${max}].`);
    }
    return n;
}

function nextAllowed(values: number[], current: number): number | null {
    for (const v of values) {
        if (v > current) return v;
    }
    return null;
}

function dayMatches(p: TimeParts, f: ParsedFields): boolean {
    const domMatch = f.daysOfMonth.allowed[p.day];
    const dowMatch = f.daysOfWeek.allowed[p.dayOfWeek === 7 ? 0 : p.dayOfWeek];
    const domRestricted = !f.daysOfMonth.wildcard;
    const dowRestricted = !f.daysOfWeek.wildcard;

    if (domRestricted && dowRestricted) return domMatch || dowMatch;
    if (domRestricted) return domMatch;
    if (dowRestricted) return dowMatch;
    return true;
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function bumpDay(p: TimeParts): void {
    p.day += 1;
    if (p.day > daysInMonth(p.year, p.month)) {
        p.day = 1;
        p.month += 1;
        if (p.month > 12) {
            p.month = 1;
            p.year += 1;
        }
    }
}

function bumpHour(p: TimeParts): void {
    p.hour += 1;
    if (p.hour > 23) {
        p.hour = 0;
        bumpDay(p);
    }
}

function bumpMinute(p: TimeParts): void {
    p.minute += 1;
    if (p.minute > 59) {
        p.minute = 0;
        bumpHour(p);
    }
}

function utcParts(date: Date): TimeParts {
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
        dayOfWeek: date.getUTCDay(),
    };
}

function partsToDate(p: TimeParts): Date {
    return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

function zonedParts(date: Date, timezone?: string): TimeParts {
    if (!timezone) return utcParts(date);
    return utcParts(new Date(date.getTime() + timezoneOffsetMs(timezone, date)));
}

function fromZoned(p: TimeParts, timezone?: string): Date {
    const date = partsToDate(p);
    if (!timezone) return date;
    return new Date(date.getTime() - timezoneOffsetMs(timezone, date));
}

function timezoneOffsetMs(timezone: string, date: Date): number {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const parts: Record<string, string> = {};
    for (const p of dtf.formatToParts(date)) {
        parts[p.type] = p.value;
    }

    let hour = parseInt(parts.hour, 10);
    if (hour === 24) hour = 0;

    const asUtc = Date.UTC(
        parseInt(parts.year, 10),
        parseInt(parts.month, 10) - 1,
        parseInt(parts.day, 10),
        hour,
        parseInt(parts.minute, 10),
        parseInt(parts.second, 10),
    );

    const utcMs = Math.floor(date.getTime() / 1000) * 1000;
    return asUtc - utcMs;
}
