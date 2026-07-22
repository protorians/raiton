import "reflect-metadata";
import {METADATA_KEYS} from "../constants/decorators.constant";
import {getControllerMetadata} from "../../core/controller";
import {Logger} from "@protorians/logger";
import {RouteInteractionsSubscriber} from "@/types";
import { Raiton } from "@/core/raiton";

/**
 * Represents a route interaction that can be rendered with context data
 */
export class RouteInteractionDescriptor {
    constructor(private template: string) {
    }

    /**
     * Renders the interaction template with the provided context data
     * Supports nested object paths using dot notation (e.g., [user.firstname])
     * @param context Object containing values for template placeholders
     * @returns Rendered interaction string with placeholders replaced by context values
     */
    render(context: Record<string, any> = {}): string {
        let result = this.template;

        // Extract all placeholders from the template
        const placeholderRegex = /\[([^\]]+)\]/g;
        let match;

        while ((match = placeholderRegex.exec(this.template)) !== null) {
            const placeholder = match[0];
            const path = match[1];

            // Get the value from context using dot notation (e.g., user.firstname)
            const value = this.getNestedValue(context, path);
            const stringValue = value !== null && value !== undefined ? String(value) : '';

            // result = result.replace(new RegExp(`\\${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), stringValue);
            result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), stringValue);
        }

        return result;
    }

    /**
     * Get a nested value from an object using dot notation
     * @param obj The object to traverse
     * @param path The dot-notation path (e.g., "user.firstname")
     * @returns The value at the path, or undefined if not found
     */
    private getNestedValue(obj: Record<string, any>, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current?.[key];
        }, obj);
    }

    /**
     * Get the raw template string
     */
    getTemplate(): string {
        return this.template;
    }
}

/**
 * Global registry of route interactions indexed by their full paths
 */
class RouteInteractionsRegistry {
    private static readonly interactions = new Map<string, RouteInteractionDescriptor>();
    public static readonly subscribers = new Set<RouteInteractionsSubscriber>();

    static subscribe(target: any, propertyKey: string) {
        this.subscribers.add({target, propertyKey});
        return this;
    }

    /**
     * Register a route interaction
     * @param fullPath The complete route path (prefix + method path)
     * @param descriptor The route interaction descriptor
     */
    static register(fullPath: string, descriptor: RouteInteractionDescriptor): typeof this {
        this.interactions.set(fullPath, descriptor);
        return this;
    }

    /**
     * Get a route interaction by its full path
     * @param fullPath The complete route path
     * @returns The interaction descriptor, or undefined if not found
     */
    static get(fullPath: string): RouteInteractionDescriptor | undefined {
        return this.interactions.get(fullPath);
    }

    /**
     * Get all registered interactions
     */
    static getAll(): Map<string, RouteInteractionDescriptor> {
        return new Map(this.interactions);
    }

    /**
     * Clear all registered interactions
     */
    static clear(): void {
        this.interactions.clear();
    }

    /**
     * Check if an interaction is registered
     */
    static has(fullPath: string): boolean {
        return this.interactions.has(fullPath);
    }
}

/**
 * Public API for accessing route interactions
 */
export class RouteInteractions {
    /**
     * Get a route interaction by its full path
     * @param path The complete route path (e.g., "/auth/sign-in/index")
     * @returns The interaction descriptor with a render method, or undefined if not found
     */
    static get(path: string): RouteInteractionDescriptor | undefined {
        return RouteInteractionsRegistry.get(path) || this.upsert(path);
    }

    /**
     * Get all registered route interactions
     */
    static getAll(): Map<string, RouteInteractionDescriptor> {
        return RouteInteractionsRegistry.getAll();
    }

    private static upsert(pathname: string): RouteInteractionDescriptor | undefined {
        const subscribers = RouteInteractionsRegistry.subscribers.values();

        for (const subscriber of subscribers) {
            const controller = getControllerMetadata(subscriber.target);
            if (!controller) continue;

            const route = controller.routes.find(r => r.propertyKey === subscriber.propertyKey);

            if (!route) continue;

            const interactions = Reflect.getMetadata(METADATA_KEYS.ROUTE_INTERACTION, subscriber.target)
            if (!interactions) continue;

            const description = interactions[subscriber.propertyKey]?.description ?? undefined;
            if (!description) continue;

            const appPrefix = Raiton.thread?.application?.config.prefix
            const fullPath = appPrefix + (controller.prefix || '') + route.path;

            if(fullPath !== pathname) continue;

            const descriptor = new RouteInteractionDescriptor(description);
            RouteInteractionsRegistry.register(fullPath, descriptor);


            return descriptor;
        }

        return undefined;
    }
}

/**
 * Decorator to add interaction description to a route method
 * @param description The interaction description template (e.g., "[user] est désormais connecté")
 */
export function RouteInteraction(description: string) {
    return (target: any, propertyKey: string) => {
        RouteInteractionsRegistry.subscribe(target, propertyKey);

        // Also store it in metadata for reference during development/inspection
        const interactions = Reflect.getMetadata(METADATA_KEYS.ROUTE_INTERACTION, target) || {};
        interactions[propertyKey] = {
            description,
            // fullPath,
            // descriptor,
        };
        Reflect.defineMetadata(METADATA_KEYS.ROUTE_INTERACTION, interactions, target);
    };
}

// Export the registry for internal use and testing
export {RouteInteractionsRegistry};
