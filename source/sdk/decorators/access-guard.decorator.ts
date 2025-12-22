import {IAccessGuardDeclaration} from "../../types";
import {SYSTEM_DECORATORS_KEYS} from "../constants";

export function AccessGuard(declaration: IAccessGuardDeclaration){
    return (target: any, methodKey: any)=> {
        const current: IAccessGuardDeclaration = {...(Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.ACCESS_GUARD, target.constructor, methodKey) || {}), ...declaration};
        Reflect.defineMetadata(SYSTEM_DECORATORS_KEYS.ACCESS_GUARD, current, target.constructor, methodKey);
    }
}