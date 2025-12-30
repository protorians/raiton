//
// import {IConstructor} from "@/types";
// import {SYSTEM_DECORATORS_KEYS} from "@/sdk";
// import {LifetimeEnum} from "@protorians/core";
// import {GraftsRegistry} from "@/sdk/grafts";
//
// /**
//  * A decorator function used for registering a class with the GraftsRegistry.
//  * It assigns a specific lifecycle and an optional name to the class.
//  *
//  * @param {LifetimeEnum} [lifetime] The lifecycle of the class instance (e.g., TRANSIENT, SINGLETON).
//  * @param {string} [name] An optional name for the class. If not provided, the class constructor's name will be used.
//  * @return {Function} A decorator function that registers the class with the GraftsRegistry.
//  */
// export function Graftable(lifetime?: LifetimeEnum, name?: string): Function {
//     return function <T extends IConstructor>(target: T) {
//         GraftsRegistry.register(name || (target as any).name, target, lifetime || LifetimeEnum.TRANSIENT);
//     };
// }
//
// /**
//  * Marks a constructor parameter to be injected from the Grafts DI container.
//  * Stores the constructor's parameter types under SYSTEM_DECORATORS_KEYS.GRAFT metadata
//  * so DependencyContainer.resolveArguments can resolve them.
//  */
// export function Graft(): Function {
//     return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
//         // For constructor parameters, propertyKey is undefined and target is the constructor function
//         // Retrieve the design time types for parameters
//         const paramTypes: any[] =
//             Reflect.getMetadata("design:paramtypes", propertyKey ? target : target, propertyKey as any) ||
//             Reflect.getMetadata("design:paramtypes", target) || [];
//
//         const depType = paramTypes[parameterIndex];
//         if (!depType) return;
//
//         // Existing dependencies list stored on the class constructor
//         const existing: any[] = Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.GRAFT, target) || [];
//         existing[parameterIndex] = depType;
//         Reflect.defineMetadata(SYSTEM_DECORATORS_KEYS.GRAFT, existing, target);
//     };
// }
