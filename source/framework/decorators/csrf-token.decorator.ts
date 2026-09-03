import {getControllerMetadata} from "../../core";
import {METADATA_KEYS} from "../constants";

export function CsrfToken() {
    return (target: any, propertyKey?: string) => {
        const meta = getControllerMetadata(target.prototype || target)
        const segment = propertyKey ? propertyKey : '@'

        if (!meta.middlewares[segment]) {
            meta.middlewares[segment] = []
        }

        meta.middlewares[segment].push(async ({context, next}: any) => {
            const token = context.state?.csrfToken
            if (token) {
                context.reply.header('X-CSRF-Token', token)
            }
            await next()
        })
    }
}
