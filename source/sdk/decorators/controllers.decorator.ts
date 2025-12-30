// import 'reflect-metadata';
// import {HttpMethodEnum} from "@/sdk/enums";
// import {SYSTEM_DECORATORS_KEYS} from "@/sdk/constants";

// export function Controllable(prefix: string): ClassDecorator {
//     return (target: any) => {
//         Reflect.defineMetadata(SYSTEM_DECORATORS_KEYS.CONTROLLERS, prefix, target);
//         if (!Reflect.hasMetadata(SYSTEM_DECORATORS_KEYS.ROUTES, target))
//             Reflect.defineMetadata(SYSTEM_DECORATORS_KEYS.ROUTES, [], target);
//     };
// }

// function create(method: HttpMethodEnum | HttpMethodEnum[]) {
//     return (path: string): MethodDecorator => {
//         return (target, propertyKey) => {
//             const routes = Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.ROUTES, target.constructor) || [];
//             routes.push({
//                 method,
//                 path,
//                 handlerName: propertyKey
//             });
//             Reflect.defineMetadata(SYSTEM_DECORATORS_KEYS.ROUTES, routes, target.constructor);
//         };
//     };
// }

// export const Get = create(HttpMethodEnum.GET);
// export const Post = create(HttpMethodEnum.POST);
// export const Put = create(HttpMethodEnum.PUT);
// export const Delete = create(HttpMethodEnum.DELETE);
// export const Patch = create(HttpMethodEnum.PATCH);
// export const Options = create(HttpMethodEnum.OPTIONS);
// export const Any = create(Object.values(HttpMethodEnum));
