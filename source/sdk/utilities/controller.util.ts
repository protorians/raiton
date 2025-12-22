export function isControllerFile(filename: string) {
    return (
        filename.endsWith(".controller.ts") ||
        filename.endsWith(".controller.js") ||
        filename.endsWith(".controller.mjs") ||
        filename.endsWith(".controller.cjs")
    )
}