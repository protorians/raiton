import {MiddlewareType} from '../../types/index.ts'
import {Throwable} from "../../framework/exceptions/index.ts";

export function middlewareCompose(middlewares: MiddlewareType[]) {
    return function (request: any) {
        let index = -1

        return dispatch(0)

        async function dispatch(i: number): Promise<void> {
            if (i <= index) {
                return Promise.reject(
                    new Throwable('next() called multiple times')
                )
            }

            index = i
            const fn = middlewares[i];
            try {
                if (!fn) return Promise.resolve()

                if (typeof fn === 'function') {
                    return Promise.resolve(fn({context: request, next: () => dispatch(i + 1)}))
                }

                if (typeof fn === 'object' && 'setup' in fn && typeof fn.setup == 'function') {
                    if (fn.setup.length === 1) {
                        await Promise.resolve(fn.setup(request))
                        return await dispatch(i + 1)
                    }
                    return Promise.resolve(fn.setup(request, () => dispatch(i + 1)))
                }

                return Promise.resolve()
            } catch (err) {
                return Promise.reject(err)
            }
        }
    }
}

/**
 * Précompose la pile de middlewares en gardant le terminal (handler de route)
 * en paramètre d'exécution. La pile n'est plus recopiée à chaque requête ;
 * `MiddlewarePipeline` invalide le runner compilé à chaque mutation.
 */
export function middlewareComposeWithTerminal(middlewares: readonly MiddlewareType[]) {
    return function (request: any, terminal: MiddlewareType) {
        let index = -1

        return dispatch(0)

        async function dispatch(i: number): Promise<void> {
            if (i <= index) {
                return Promise.reject(
                    new Throwable('next() called multiple times')
                )
            }

            index = i

            if (i >= middlewares.length) {
                return Promise.resolve(
                    (terminal as any)({context: request, next: () => dispatch(i + 1)})
                )
            }

            const fn = middlewares[i];
            try {
                if (typeof fn === 'function') {
                    return Promise.resolve(fn({context: request, next: () => dispatch(i + 1)}))
                }

                if (typeof fn === 'object' && 'setup' in fn && typeof fn.setup == 'function') {
                    if (fn.setup.length === 1) {
                        await Promise.resolve(fn.setup(request))
                        return await dispatch(i + 1)
                    }
                    return Promise.resolve(fn.setup(request, () => dispatch(i + 1)))
                }

                return await dispatch(i + 1)
            } catch (err) {
                return Promise.reject(err)
            }
        }
    }
}
