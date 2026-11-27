import type {DebugRouteSource, DebugTimelineStep, DebugValidationSummary} from "./types.ts";

export interface DebugErrorLike {
    code: string;
    message: string;
    statusCode?: number;
    stack?: string[];
    location?: string;
}

/** Request-scoped capture state, attached to `ctx.state.debug`. */
export interface DebugTraceState {
    startedAt: string;
    startPerf: number;
    requestId: string;
    traceId: string;
    method: string;
    pathname: string;
    timeline: DebugTimelineStep[];
    handlerExecuted: boolean;
    validation?: DebugValidationSummary;
    error?: DebugErrorLike;
    source?: DebugRouteSource;
    cache?: {hit: boolean};
    responseBody?: any;
    captured: boolean;
}
