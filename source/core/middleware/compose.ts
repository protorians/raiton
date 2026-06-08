import {MiddlewareType} from '../../types'
import {Throwable} from "../../sdk/exceptions";

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
