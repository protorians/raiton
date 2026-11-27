import type {ConfigurableInterface} from "../../types/config.ts";

export interface ConfigFieldError {
    field: string;
    message: string;
    expected?: string;
    received?: string;
}

export interface ConfigValidationResult {
    valid: boolean;
    errors: ConfigFieldError[];
}

function describe(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

function checkBoolean(errors: ConfigFieldError[], config: any, field: string) {
    if (config[field] !== undefined && typeof config[field] !== "boolean") {
        errors.push({
            field,
            message: `${field} must be a boolean`,
            expected: "boolean",
            received: describe(config[field]),
        });
    }
}

function checkString(errors: ConfigFieldError[], config: any, field: string) {
    if (config[field] !== undefined && typeof config[field] !== "string") {
        errors.push({
            field,
            message: `${field} must be a string`,
            expected: "string",
            received: describe(config[field]),
        });
    }
}

/**
 * Validate a project configuration loaded from `raiton.config.*`.
 * Errors are field-scoped so startup can fail with actionable messages.
 */
export function validateConfig(input: Partial<ConfigurableInterface> | any): ConfigValidationResult {
    const errors: ConfigFieldError[] = [];
    const config = input ?? {};

    if (config.rootDir !== undefined) {
        if (typeof config.rootDir !== "string" || !config.rootDir.trim()) {
            errors.push({
                field: "rootDir",
                message: "rootDir must be a non-empty string",
                expected: "string",
                received: describe(config.rootDir),
            });
        }
    }

    checkString(errors, config, "version");
    checkString(errors, config, "hostname");
    checkString(errors, config, "pathname");
    checkString(errors, config, "prefix");
    checkBoolean(errors, config, "develop");
    checkBoolean(errors, config, "verbose");

    if (config.port !== undefined) {
        if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
            errors.push({
                field: "port",
                message: "port must be an integer between 1 and 65535",
                expected: "integer(1..65535)",
                received: String(config.port),
            });
        }
    }

    if (config.protocole !== undefined && !["http", "https"].includes(config.protocole)) {
        errors.push({
            field: "protocole",
            message: "protocole must be 'http' or 'https'",
            expected: "http|https",
            received: String(config.protocole),
        });
    }

    if (config.artifacts !== undefined) {
        if (typeof config.artifacts !== "object" || config.artifacts === null) {
            errors.push({field: "artifacts", message: "artifacts must be an object"});
        } else if (config.artifacts.types !== undefined
            && (!Array.isArray(config.artifacts.types)
                || config.artifacts.types.some((type: any) => typeof type !== "string"))) {
            errors.push({
                field: "artifacts.types",
                message: "artifacts.types must be an array of strings",
                expected: "string[]",
                received: describe(config.artifacts.types),
            });
        }
    }

    if (config.devPage !== undefined && config.devPage.path !== undefined
        && (typeof config.devPage.path !== "string" || !config.devPage.path.startsWith("/"))) {
        errors.push({
            field: "devPage.path",
            message: "devPage.path must be an absolute path",
            expected: "string starting with /",
        });
    }

    if (config.observability !== undefined) {
        if (typeof config.observability !== "object" || config.observability === null) {
            errors.push({field: "observability", message: "observability must be an object"});
        } else {
            const mode = config.observability.mode;
            if (mode !== undefined && !["off", "metrics", "traces", "all"].includes(mode)) {
                errors.push({
                    field: "observability.mode",
                    message: "observability.mode must be off, metrics, traces, or all",
                    expected: "off|metrics|traces|all",
                    received: String(mode),
                });
            }
            if (config.observability.metricsPath !== undefined
                && (typeof config.observability.metricsPath !== "string"
                    || !config.observability.metricsPath.startsWith("/"))) {
                errors.push({
                    field: "observability.metricsPath",
                    message: "observability.metricsPath must be an absolute path",
                    expected: "string starting with /",
                });
            }
        }
    }

    if (config.validation !== undefined) {
        if (typeof config.validation !== "object" || config.validation === null) {
            errors.push({field: "validation", message: "validation must be an object"});
        } else if (config.validation.responses !== undefined
            && typeof config.validation.responses !== "boolean"
            && config.validation.responses !== "auto") {
            errors.push({
                field: "validation.responses",
                message: "validation.responses must be a boolean or 'auto'",
                expected: "boolean|auto",
                received: String(config.validation.responses),
            });
        }
    }

    if (config.shutdown !== undefined) {
        const timeout = config.shutdown?.timeoutMs;
        if (timeout !== undefined && (!Number.isInteger(timeout) || timeout < 0)) {
            errors.push({
                field: "shutdown.timeoutMs",
                message: "shutdown.timeoutMs must be a positive integer",
                expected: "integer >= 0",
                received: String(timeout),
            });
        }
    }

    if (config.devPage !== undefined) {
        checkBoolean(errors, config.devPage, "enabled");
        checkString(errors, config.devPage, "path");
    }

    if (config.mcp !== undefined) {
        checkBoolean(errors, config.mcp, "exposeDestructive");
        const rate = config.mcp?.rateLimitPerMinute;
        if (rate !== undefined && (!Number.isInteger(rate) || rate < 0)) {
            errors.push({
                field: "mcp.rateLimitPerMinute",
                message: "mcp.rateLimitPerMinute must be a non-negative integer",
                expected: "integer >= 0",
                received: String(rate),
            });
        }
    }

    if (config.debug !== undefined) {
        if (typeof config.debug !== "object" || config.debug === null) {
            errors.push({field: "debug", message: "debug must be an object"});
        } else {
            checkBoolean(errors, config.debug, "enabled");
            const journal = config.debug.journal;
            if (journal !== undefined) {
                if (typeof journal !== "object" || journal === null) {
                    errors.push({field: "debug.journal", message: "debug.journal must be an object"});
                } else {
                    checkBoolean(errors, journal, "enabled");
                    const capacity = journal.capacity;
                    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) {
                        errors.push({
                            field: "debug.journal.capacity",
                            message: "debug.journal.capacity must be a positive integer",
                            expected: "integer >= 1",
                            received: String(capacity),
                        });
                    }
                    const maxBody = journal.maxBodyBytes;
                    if (maxBody !== undefined && (!Number.isInteger(maxBody) || maxBody < 0)) {
                        errors.push({
                            field: "debug.journal.maxBodyBytes",
                            message: "debug.journal.maxBodyBytes must be a non-negative integer",
                            expected: "integer >= 0",
                            received: String(maxBody),
                        });
                    }
                    if (journal.capture !== undefined && !["off", "metadata", "full"].includes(journal.capture)) {
                        errors.push({
                            field: "debug.journal.capture",
                            message: "debug.journal.capture must be off, metadata or full",
                            expected: "off|metadata|full",
                            received: String(journal.capture),
                        });
                    }
                    if (journal.ttlMs !== undefined && (!Number.isInteger(journal.ttlMs) || journal.ttlMs < 0)) {
                        errors.push({
                            field: "debug.journal.ttlMs",
                            message: "debug.journal.ttlMs must be a non-negative integer",
                            expected: "integer >= 0",
                            received: String(journal.ttlMs),
                        });
                    }
                    if (journal.sampleRate !== undefined
                        && (typeof journal.sampleRate !== "number" || journal.sampleRate < 0 || journal.sampleRate > 1)) {
                        errors.push({
                            field: "debug.journal.sampleRate",
                            message: "debug.journal.sampleRate must be between 0 and 1",
                            expected: "number(0..1)",
                            received: String(journal.sampleRate),
                        });
                    }
                    if (journal.redact !== undefined
                        && (!Array.isArray(journal.redact) || journal.redact.some((key: any) => typeof key !== "string"))) {
                        errors.push({
                            field: "debug.journal.redact",
                            message: "debug.journal.redact must be an array of strings",
                            expected: "string[]",
                            received: describe(journal.redact),
                        });
                    }
                }
            }
            const http = config.debug.http;
            if (http !== undefined) {
                if (typeof http !== "object" || http === null) {
                    errors.push({field: "debug.http", message: "debug.http must be an object"});
                } else {
                    checkBoolean(errors, http, "enabled");
                    checkBoolean(errors, http, "loopbackOnly");
                    if (http.basePath !== undefined && (typeof http.basePath !== "string" || !http.basePath.startsWith("/"))) {
                        errors.push({
                            field: "debug.http.basePath",
                            message: "debug.http.basePath must be an absolute path",
                            expected: "string starting with /",
                        });
                    }
                    checkString(errors, http, "tokenEnv");
                }
            }
            const mcp = config.debug.mcp;
            if (mcp !== undefined) {
                if (typeof mcp !== "object" || mcp === null) {
                    errors.push({field: "debug.mcp", message: "debug.mcp must be an object"});
                } else {
                    checkBoolean(errors, mcp, "enabled");
                    if (mcp.path !== undefined && (typeof mcp.path !== "string" || !mcp.path.startsWith("/"))) {
                        errors.push({
                            field: "debug.mcp.path",
                            message: "debug.mcp.path must be an absolute path",
                            expected: "string starting with /",
                        });
                    }
                }
            }
            if (config.debug.replay !== undefined) {
                checkBoolean(errors, config.debug.replay, "allowUnsafeMethods");
            }
        }
    }

    return {valid: errors.length === 0, errors};
}

export class ConfigValidationError extends Error {
    constructor(public readonly errors: ConfigFieldError[]) {
        super(`Invalid Raiton configuration:\n${errors.map(error => `- ${error.field}: ${error.message}`).join("\n")}`);
        this.name = "ConfigValidationError";
    }
}

/**
 * JSON Schema published for editors (autocomplete) and external validators.
 */
export function getConfigJsonSchema(): Record<string, any> {
    return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: "https://raiton.protorians.dev/schemas/config-1.0.0.json",
        title: "Raiton project configuration",
        type: "object",
        additionalProperties: true,
        properties: {
            rootDir: {type: "string", minLength: 1, default: "./source"},
            version: {type: "string"},
            port: {type: "integer", minimum: 1, maximum: 65535},
            hostname: {type: "string"},
            protocole: {enum: ["http", "https"]},
            pathname: {type: "string"},
            prefix: {type: "string"},
            develop: {type: "boolean"},
            verbose: {type: "boolean"},
            artifacts: {
                type: "object",
                properties: {
                    types: {type: "array", items: {type: "string"}, uniqueItems: true},
                },
            },
            observability: {
                type: "object",
                properties: {
                    mode: {enum: ["off", "metrics", "traces", "all"], default: "off"},
                    metricsPath: {type: "string", pattern: "^/"},
                    otelEndpoint: {type: "string", format: "uri"},
                    requestIdHeader: {type: "string"},
                    serviceName: {type: "string"},
                },
            },
            validation: {
                type: "object",
                properties: {
                    responses: {oneOf: [{type: "boolean"}, {const: "auto"}]},
                },
            },
            shutdown: {
                type: "object",
                properties: {timeoutMs: {type: "integer", minimum: 0, default: 10000}},
            },
            devPage: {
                type: "object",
                properties: {
                    enabled: {type: "boolean"},
                    path: {type: "string", pattern: "^/"},
                },
            },
            mcp: {
                type: "object",
                properties: {
                    exposeDestructive: {type: "boolean", default: false},
                    rateLimitPerMinute: {type: "integer", minimum: 0},
                },
            },
            debug: {
                type: "object",
                properties: {
                    enabled: {type: "boolean"},
                    journal: {
                        type: "object",
                        properties: {
                            enabled: {type: "boolean"},
                            capacity: {type: "integer", minimum: 1, default: 1000},
                            maxBodyBytes: {type: "integer", minimum: 0, default: 65536},
                            capture: {enum: ["off", "metadata", "full"]},
                            ttlMs: {type: "integer", minimum: 0, default: 900000},
                            sampleRate: {type: "number", minimum: 0, maximum: 1},
                            redact: {type: "array", items: {type: "string"}, uniqueItems: true},
                        },
                    },
                    http: {
                        type: "object",
                        properties: {
                            enabled: {type: "boolean"},
                            basePath: {type: "string", pattern: "^/", default: "/__raiton"},
                            loopbackOnly: {type: "boolean", default: true},
                            tokenEnv: {type: "string", default: "RAITON_DEBUG_TOKEN"},
                        },
                    },
                    mcp: {
                        type: "object",
                        properties: {
                            enabled: {type: "boolean"},
                            path: {type: "string", pattern: "^/", default: "/__raiton/mcp"},
                        },
                    },
                    replay: {
                        type: "object",
                        properties: {
                            allowUnsafeMethods: {type: "boolean", default: false},
                        },
                    },
                },
            },
            docs: {
                type: "object",
                properties: {
                    dir: {type: "string"},
                    lang: {enum: ["fr", "en"]},
                },
            },
        },
        required: ["rootDir"],
    };
}
