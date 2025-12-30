import {Middleware} from '@/types'

export function compose(middlewares: Middleware[]) {
    return function (ctx: any) {
        let index = -1

        return dispatch(0)

        async function dispatch(i: number): Promise<void> {
            if (i <= index) {
                return Promise.reject(
                    new Error('next() called multiple times')
                )
            }

            index = i
            const fn = middlewares[i];
            try {
                if (!fn) return Promise.resolve()

                if (typeof fn === 'function') {
                    return Promise.resolve(fn(ctx, () => dispatch(i + 1)))
                }

                if (typeof fn === 'object' && 'setup' in fn && typeof fn.setup == 'function') {
                    if (fn.setup.length === 1) {
                        await Promise.resolve(fn.setup(ctx))
                        return await dispatch(i + 1)
                    }
                    return Promise.resolve(fn.setup(ctx, () => dispatch(i + 1)))
                }

                return Promise.resolve()
            } catch (err) {
                return Promise.reject(err)
            }
        }
    }
}
