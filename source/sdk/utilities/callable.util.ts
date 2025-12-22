import {LBadge, Logger} from "@protorians/logger";

export async function retryCallable(
    label: string,
    callback: () => Promise<void>,
    onFail?: (e: any) => void,
    trying: number = 0,
    limit: number = 7,
) {
    try {
        Logger.info(
            LBadge.debug(label || 'Running'),
            LBadge.info(trying),
            LBadge.log(limit),
        )
        await callback()
    } catch (e) {
        Logger.info(
            LBadge.debug('Trying'),
            LBadge.info(trying),
            LBadge.log(limit),
        )
        if (trying < limit)
            setTimeout(() => retryCallable(label, callback, onFail, trying + 1, limit), 1000);
        else onFail?.(e)
    }
}