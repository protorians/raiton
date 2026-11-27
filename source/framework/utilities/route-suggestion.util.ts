export interface SuggestableRoute {
    method: string;
    path: string;
    version?: string;
}

function fullPath(route: SuggestableRoute): string {
    return route.version ? `/${route.version}${route.path}` : route.path;
}

function distance(left: string, right: string): number {
    const a = left.split("/").filter(Boolean);
    const b = right.split("/").filter(Boolean);
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix: number[][] = Array.from({length: rows}, () => new Array(cols).fill(0));

    for (let row = 0; row < rows; row++) matrix[row][0] = row;
    for (let col = 0; col < cols; col++) matrix[0][col] = col;

    for (let row = 1; row < rows; row++) {
        for (let col = 1; col < cols; col++) {
            const cost = a[row - 1] === b[col - 1] ? 0 : 1;
            matrix[row][col] = Math.min(
                matrix[row - 1][col] + 1,
                matrix[row][col - 1] + 1,
                matrix[row - 1][col - 1] + cost,
            );
        }
    }

    return matrix[rows - 1][cols - 1];
}

/**
 * Suggest the closest known route for a 404 response in development. Only
 * routes whose shape is reasonably close are returned.
 */
export function suggestRoute(
    routes: SuggestableRoute[],
    method: string,
    pathname: string,
): string | undefined {
    const requested = pathname.replace(/\/+$/, "") || "/";
    let best: {route: SuggestableRoute; score: number} | null = null;

    for (const route of routes) {
        const candidate = fullPath(route).replace(/\/+$/, "") || "/";
        const segments = distance(requested, candidate);
        const methodPenalty = route.method.toUpperCase() === method.toUpperCase() ? 0 : 1;
        const score = segments + methodPenalty;
        if (!best || score < best.score) best = {route, score};
    }

    if (!best) return undefined;
    const maxSegments = Math.max(requested.split("/").length, fullPath(best.route).split("/").length);
    if (best.score > Math.max(2, Math.ceil(maxSegments / 2))) return undefined;
    return `${best.route.method.toUpperCase()} ${fullPath(best.route)}`;
}
