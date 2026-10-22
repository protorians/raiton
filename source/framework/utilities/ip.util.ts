import os from 'node:os'

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

/**
 * Get the server's LAN IPv4 address.
 *
 * Prefers private (RFC1918) addresses on physical adapters and skips
 * link-local (169.254.0.0/16) addresses exposed by interfaces without
 * DHCP (en9, awdl0, llw0, utun*, bridges...) so that the first address
 * found is the real one.
 */
export const getLanIp = (): string | undefined => {
    const candidates: {name: string; address: string; score: number}[] = [];

    for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
        for (const addr of addrs || []) {
            if (addr.family !== 'IPv4' || addr.internal) continue;
            // Skip link-local (APIPA) addresses: interfaces without DHCP
            if (addr.address.startsWith('169.254.')) continue;

            let score = 0;
            // Prefer private (RFC1918) ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
            if (/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(addr.address)) score += 4;
            // Deprioritize well-known virtual interfaces
            if (/^(utun|awdl|llw|bridge|vmnet|docker|veth|tun|tap|ppp)/.test(name)) score -= 2;
            // Slightly prefer physical adapters (macOS en*, Linux eth/wlan)
            if (/^(en|eth|wlan)/.test(name)) score += 1;

            candidates.push({name, address: addr.address, score});
        }
    }

    return candidates.sort((a, b) => b.score - a.score)[0]?.address;
}
