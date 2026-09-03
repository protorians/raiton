import "reflect-metadata";
import {METADATA_KEYS} from "../constants/decorators.constant";
import {getControllerMetadata} from "../../core/controller";
import {RouteMetaInterface} from "../../types";

export interface HealthCheckOptions {
    path?: string;
    tags?: string[];
    summary?: string;
    description?: string;
    excludeFromDocs?: boolean;
}

export interface HealthCheckMetadata {
    options: HealthCheckOptions;
    routeMeta?: RouteMetaInterface;
    controllerPrefix?: string;
}

const DEFAULT_HEALTH_CHECK_OPTIONS: HealthCheckOptions = {
    path: '/health',
    tags: ['Health'],
    summary: 'Health check endpoint',
    description: 'Returns the health status of the application',
    excludeFromDocs: false,
};

export function HealthCheck(options: HealthCheckOptions = {}) {
    return (target: any, propertyKey: string) => {
        const mergedOptions = {...DEFAULT_HEALTH_CHECK_OPTIONS, ...options};
        const controllerMeta = getControllerMetadata(target.prototype || target);
        const route = controllerMeta.routes.find(r => r.propertyKey === propertyKey);

        const metadata: HealthCheckMetadata = {
            options: mergedOptions,
            routeMeta: route,
            controllerPrefix: controllerMeta.prefix,
        };

        Reflect.defineMetadata(METADATA_KEYS.HEALTH_CHECK, metadata, target, propertyKey);
    }
}

export function getHealthCheckMetadata(target: any, propertyKey: string): HealthCheckMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEYS.HEALTH_CHECK, target, propertyKey);
}

export function isHealthCheck(target: any, propertyKey: string): boolean {
    return Reflect.hasMetadata(METADATA_KEYS.HEALTH_CHECK, target, propertyKey);
}
