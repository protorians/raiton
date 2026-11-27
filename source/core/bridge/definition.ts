import type {ArtifactBridgeDefinition, ArtifactBridgeEntry} from "../../types/bridge.ts";
import {BridgeError} from "./diagnostics.ts";

/**
 * Public helper used by `artifacts.bridge.ts` files.
 *
 * The preferred form is `{ artifacts: [...] }`; a bare array is accepted for
 * convenience. Validation happens here so the runtime receives a normalized
 * manifest.
 */
export function defineArtifactBridge(
    definition: ArtifactBridgeDefinition | ArtifactBridgeEntry[],
): ArtifactBridgeDefinition {
    const artifacts = Array.isArray(definition)
        ? definition
        : definition?.artifacts;

    if (!Array.isArray(artifacts)) {
        throw new BridgeError("BRIDGE_FILE_INVALID_EXPORT", {
            message: "defineArtifactBridge() requires an `artifacts` array",
            action: "Call defineArtifactBridge({ artifacts: [...] }).",
            entry: "artifacts",
        });
    }

    return Array.isArray(definition)
        ? {artifacts}
        : {...definition, artifacts};
}

export function isArtifactBridgeDefinition(value: unknown): value is ArtifactBridgeDefinition {
    return Boolean(value)
        && typeof value === "object"
        && Array.isArray((value as any).artifacts);
}
