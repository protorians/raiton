/**
 * Get the real IP address from headers or remote address
 * @param headers
 * @param remoteAddress
 */
export const getRealIp = (headers: Headers, remoteAddress?: string): string | undefined => {
    const forwardedFor = headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return headers.get('x-real-ip') || remoteAddress;
}
