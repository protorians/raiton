import {HttpStatus, HttpMethod} from "./enums";
import {RaitonResponses} from "./responses/helpers";
import {ApplicationInterface} from "../types/application";
import {RequestContext} from "../core/context";

export interface HealthCheckConfig {
    enabled: boolean;
    path: string;
    response?: {
        status?: 'healthy' | 'unhealthy' | 'degraded';
        statusCode?: HttpStatus;
        message?: string;
    };
    checks?: HealthCheckCheck[];
}

export type HealthCheckStatus = 'healthy' | 'unhealthy' | 'degraded';

export interface HealthCheckResult {
    name: string;
    status: HealthCheckStatus;
    message?: string;
    duration?: number;
}

export interface HealthCheckCheck {
    name: string;
    check: () => Promise<{ status: HealthCheckStatus; message?: string }> | { status: HealthCheckStatus; message?: string };
}

export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
    enabled: true,
    path: '/health',
    response: {
        status: 'healthy',
        statusCode: HttpStatus.OK,
        message: 'Service is healthy',
    },
    checks: [],
};

export class HealthCheckManager {
    private static _config: HealthCheckConfig = {...DEFAULT_HEALTH_CHECK_CONFIG};
    private static _customHandler: ((ctx: RequestContext) => Promise<any> | any) | null = null;

    static configure(config: Partial<HealthCheckConfig>): void {
        this._config = {...this._config, ...config};
    }

    static getConfig(): HealthCheckConfig {
        return {...this._config};
    }

    static registerCustomHandler(handler: (ctx: RequestContext) => Promise<any> | any): void {
        this._customHandler = handler;
    }

    static async runChecks(): Promise<HealthCheckResult[]> {
        const results: HealthCheckResult[] = [];

        for (const check of this._config.checks || []) {
            const start = Date.now();
            try {
                const result = await check.check();
                results.push({
                    name: check.name,
                    status: result.status,
                    message: result.message,
                    duration: Date.now() - start,
                });
            } catch (error: any) {
                results.push({
                    name: check.name,
                    status: 'unhealthy',
                    message: error.message || 'Check failed',
                    duration: Date.now() - start,
                });
            }
        }

        return results;
    }

    static async handleHealthCheck(ctx: RequestContext): Promise<any> {
        if (this._customHandler) {
            return this._customHandler(ctx);
        }

        const checks = await this.runChecks();
        const timestamp = new Date().toISOString();

        let overallStatus: HealthCheckStatus = 'healthy';
        if (checks.some(c => c.status === 'unhealthy')) {
            overallStatus = 'unhealthy';
        } else if (checks.some(c => c.status === 'degraded')) {
            overallStatus = 'degraded';
        }

        const statusCode = overallStatus === 'unhealthy'
            ? HttpStatus.SERVICE_UNAVAILABLE
            : (this._config.response?.statusCode || HttpStatus.OK);

        return RaitonResponses(
            this._config.response?.message || `Service is ${overallStatus}`,
            {
                status: overallStatus,
                timestamp,
                checks: checks.length > 0 ? checks : undefined,
                uptime: process.uptime(),
                version: process.env.npm_package_version || '0.0.0',
            },
            statusCode,
            {error: overallStatus === 'unhealthy'}
        );
    }
}

export function hasRegisteredHealthCheck(app: ApplicationInterface): boolean {
    const config = HealthCheckManager.getConfig();
    const rootScope = (app as any).root;
    if (!rootScope?.router) return false;

    const routes = rootScope.router.getRoutes();
    return routes.some((route: any) =>
        route.path === config.path && route.method === HttpMethod.GET
    );
}

export function registerDefaultHealthCheck(app: ApplicationInterface): void {
    const config = HealthCheckManager.getConfig();
    if (!config.enabled) return;
    if (hasRegisteredHealthCheck(app)) return;

    app.get(config.path, (ctx: RequestContext) => {
        return HealthCheckManager.handleHealthCheck(ctx);
    });
}
