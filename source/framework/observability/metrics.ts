export interface MetricLabels {
    [key: string]: string | number | boolean | undefined;
}

const DEFAULT_BUCKETS = [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function labelKey(labels?: MetricLabels): string {
    if (!labels) return "";
    const entries = Object.entries(labels)
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}="${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`);
    return entries.length ? `{${entries.join(",")}}` : "";
}

function metricName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_:]/g, "_");
}

interface CounterEntry {
    name: string;
    help: string;
    values: Map<string, number>;
}

interface HistogramEntry {
    name: string;
    help: string;
    buckets: number[];
    values: Map<string, {counts: number[]; sum: number; count: number}>;
}

/**
 * Dependency-free Prometheus registry. It is only touched when the
 * `metrics` observability mode is enabled, so the hot path stays unchanged
 * when observability is off.
 */
export class MetricsRegistry {
    private counters = new Map<string, CounterEntry>();
    private histograms = new Map<string, HistogramEntry>();

    counter(name: string, help = ""): this {
        const key = metricName(name);
        if (!this.counters.has(key)) this.counters.set(key, {name: key, help, values: new Map()});
        return this;
    }

    increment(name: string, labels?: MetricLabels, value = 1): this {
        const key = metricName(name);
        let entry = this.counters.get(key);
        if (!entry) {
            entry = {name: key, help: `${name} counter`, values: new Map()};
            this.counters.set(key, entry);
        }
        const labelsKey = labelKey(labels);
        entry.values.set(labelsKey, (entry.values.get(labelsKey) ?? 0) + value);
        return this;
    }

    histogram(name: string, help = "", buckets = DEFAULT_BUCKETS): this {
        const key = metricName(name);
        if (!this.histograms.has(key)) {
            this.histograms.set(key, {
                name: key,
                help,
                buckets: [...buckets].sort((a, b) => a - b),
                values: new Map(),
            });
        }
        return this;
    }

    observe(name: string, value: number, labels?: MetricLabels): this {
        const key = metricName(name);
        let entry = this.histograms.get(key);
        if (!entry) {
            entry = {
                name: key,
                help: `${name} histogram`,
                buckets: DEFAULT_BUCKETS,
                values: new Map(),
            };
            this.histograms.set(key, entry);
        }
        const labelsKey = labelKey(labels);
        let bucketData = entry.values.get(labelsKey);
        if (!bucketData) {
            bucketData = {counts: new Array(entry.buckets.length).fill(0), sum: 0, count: 0};
            entry.values.set(labelsKey, bucketData);
        }
        bucketData.sum += value;
        bucketData.count += 1;
        for (let index = 0; index < entry.buckets.length; index++) {
            if (value <= entry.buckets[index]) bucketData.counts[index] += 1;
        }
        return this;
    }

    reset(): void {
        this.counters.clear();
        this.histograms.clear();
    }

    snapshot(): Record<string, any> {
        return {
            counters: Object.fromEntries([...this.counters].map(([name, entry]) => [
                name,
                Object.fromEntries(entry.values),
            ])),
            histograms: Object.fromEntries([...this.histograms].map(([name, entry]) => [
                name,
                {
                    buckets: entry.buckets,
                    values: Object.fromEntries([...entry.values].map(([labels, value]) => [labels, {
                        count: value.count,
                        sum: value.sum,
                    }])),
                },
            ])),
        };
    }

    /**
     * Prometheus text exposition format (version 0.0.4).
     */
    render(): string {
        const lines: string[] = [];

        for (const entry of this.counters.values()) {
            if (entry.help) lines.push(`# HELP ${entry.name} ${entry.help}`);
            lines.push(`# TYPE ${entry.name} counter`);
            if (entry.values.size === 0) lines.push(`${entry.name} 0`);
            for (const [labels, value] of entry.values) {
                lines.push(`${entry.name}${labels} ${value}`);
            }
        }

        for (const entry of this.histograms.values()) {
            if (entry.help) lines.push(`# HELP ${entry.name} ${entry.help}`);
            lines.push(`# TYPE ${entry.name} histogram`);
            for (const [labels, data] of entry.values) {
                for (let index = 0; index < entry.buckets.length; index++) {
                    const bucketLabels = labelKeyWithExtra(labels, `le="${entry.buckets[index]}"`);
                    lines.push(`${entry.name}_bucket${bucketLabels} ${data.counts[index]}`);
                }
                const infLabels = labelKeyWithExtra(labels, 'le="+Inf"');
                lines.push(`${entry.name}_bucket${infLabels} ${data.count}`);
                lines.push(`${entry.name}_sum${labels} ${data.sum}`);
                lines.push(`${entry.name}_count${labels} ${data.count}`);
            }
        }

        return lines.join("\n") + (lines.length ? "\n" : "");
    }
}

function labelKeyWithExtra(labels: string, extra: string): string {
    if (!labels) return `{${extra}}`;
    return `{${labels.slice(1, -1)},${extra}}`;
}

export const metrics = new MetricsRegistry();
