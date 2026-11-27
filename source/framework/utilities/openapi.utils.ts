import type {PluginScope} from "../../core/plugins/scope.ts";

/**
 * Génération OpenAPI paresseuse : l'implémentation (et ses dépendances :
 * contrats, thread, configuration) n'est chargée qu'au premier appel. Le
 * démarrage du framework ne paie donc pas ce module.
 */
export async function generateOpenApiSpec(scope: PluginScope, opts: any): Promise<any> {
    const {generateOpenApiSpec: generate} = await import("./openapi.utils.impl.ts")
    return generate(scope, opts)
}
