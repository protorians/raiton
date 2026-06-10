export function isControllerArtifact(filename: string) {
    return isArtifact(filename, 'controller')
}

export function isSocketArtifact(filename: string) {
    return isArtifact(filename, 'socket')
}

export function isServiceArtifact(filename: string) {
    return isArtifact(filename, 'service')
}

export function isArtifact(filename: string, artifact: string) {
    return [
        filename.endsWith(`.${artifact}.ts`),
        filename.endsWith(`.${artifact}.js`),
        filename.endsWith(`.${artifact}.mjs`),
        filename.endsWith(`.${artifact}.cjs`),
    ].some(Boolean)
}

