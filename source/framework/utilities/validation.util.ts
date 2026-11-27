/**
 * Chargement paresseux de `class-validator`.
 *
 * Le paquet est optionnel à l'exécution : une application qui n'utilise ni DTO
 * ni validation de réponse ne doit pas le charger au démarrage.
 */
export type ClassValidatorModule = typeof import("class-validator")

let classValidatorPromise: Promise<ClassValidatorModule> | undefined

export function loadClassValidator(): Promise<ClassValidatorModule> {
    return (classValidatorPromise ??= import("class-validator").catch((error: any) => {
        classValidatorPromise = undefined
        throw new Error(
            'class-validator is required for DTO/response validation. ' +
            'Install it with `bun add class-validator` or `npm install class-validator`. ' +
            `Original error: ${error?.message ?? error}`
        )
    }))
}
