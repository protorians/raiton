import {MiddlewareParametersInterface} from "./middleware";

export interface GuardOptions {
    name: string;
    handler: GuardCallable
}

export interface GuardDeclaration extends GuardOptions {
    enabled: boolean;
}

export type GuardCallable = (parameters: MiddlewareParametersInterface) => Promise<boolean> | boolean