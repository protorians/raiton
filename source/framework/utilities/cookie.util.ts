export function parseCookie(cookieHeader: string | null): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach(part => {
        const [key, ...valueParts] = part.trim().split('=');
        if (key) {
            cookies[key] = valueParts.join('=');
        }
    });
    return cookies;
}
