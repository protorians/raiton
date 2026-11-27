import type {ApplicationInterface} from "../types/application.ts";
import type {ArtifactKind, ArtifactOrigin} from "../types/bridge.ts";
import type {ConstructorType} from "../types/contruct.ts";
import type {ArtifactClassification} from "../framework/artifacts.ts";
import {Injection} from "./injection/injection.ts";
import {compileController} from "./controller/compiler.ts";
import {ControllerRouteTracker} from "./controller/tracker.ts";
import {compileSocket} from "./socket/builder.ts";
import {compileMcp} from "./mcp/builder.ts";
import {compileScheduler} from "./scheduler/builder.ts";
import {ArtifactRegistry, artifactKey, type MountedArtifactRecord} from "./bridge/registry.ts";
import {BridgeError} from "./bridge/diagnostics.ts";

export function kindForClassification(classification: ArtifactClassification): ArtifactKind {
    switch (classification.channel) {
        case "hmr:controller":
            return "controller";
        case "hmr:socket":
            return "socket";
        case "hmr:mcp":
            return "mcp";
        case "hmr:scheduler":
            return "scheduler";
        default:
            return "di";
    }
}

export function isMountableClassification(classification: ArtifactClassification | null | undefined): boolean {
    return Boolean(classification) && [
        "hmr:controller",
        "hmr:socket",
        "hmr:mcp",
        "hmr:scheduler",
    ].includes(classification!.channel);
}

export interface MountArtifactOptions {
    origin: ArtifactOrigin;
    file?: string;
    package?: string;
    /** Reject a DI name collision instead of silently keeping the existing class. */
    strictInjectables?: boolean;
}

/**
 * Reuse the existing compilers to mount an already imported artifact. This is
 * the single path shared by the suffix scan and the artifact bridge.
 */
export async function mountArtifact(
    construct: ConstructorType,
    kind: ArtifactKind,
    application: ApplicationInterface,
    options: MountArtifactOptions,
): Promise<MountedArtifactRecord> {
    const name = construct.name || (construct as any).constructor?.name || "AnonymousArtifact";

    if (kind === "di") {
        const adopted = Injection.adopt(construct);
        if (adopted.status === "collision" && options.strictInjectables) {
            const previousFile = adopted.existing
                ? Injection.getArtifactPath(adopted.name)
                : undefined;
            throw new BridgeError("BRIDGE_NAME_COLLISION", {
                message: `Injection name "${adopted.name}" is already used by another class`,
                action: "Rename one of the classes or declare a unique name with @Injectable(lifetime, \"vendor:name\").",
                location: options.file ?? previousFile,
                entry: name,
            });
        }
        if (options.file) Injection.registerArtifactPath(adopted.name || name, options.file);
        const record: MountedArtifactRecord = {
            key: artifactKey({kind, name: adopted.name || name, file: options.file, package: options.package}),
            name: adopted.name || name,
            kind,
            origin: options.origin,
            construct,
            ...(options.file ? {file: options.file} : {}),
            ...(options.package ? {package: options.package} : {}),
        };
        return ArtifactRegistry.add(record);
    }

    const adopted = Injection.adopt(construct);
    if (adopted.status === "collision" && options.strictInjectables) {
        throw new BridgeError("BRIDGE_NAME_COLLISION", {
            message: `Injection name "${adopted.name}" is already used by another class`,
            action: "Rename one of the classes or declare a unique name with @Injectable(lifetime, \"vendor:name\").",
            location: options.file,
            entry: name,
        });
    }
    if (options.file) Injection.registerArtifactPath(name, options.file);

    let routes: any[] | undefined;

    if (kind === "controller") {
        compileController(construct, application, {
            origin: options.origin === "scan" ? "scan" : "bridge",
            ...(options.origin === "scan" ? {} : {trackerKey: `bridge:${name}`}),
        });
        routes = ControllerRouteTracker.getRoutes(
            name,
            options.origin === "scan" ? "scan" : "bridge",
            options.origin === "scan" ? undefined : `bridge:${name}`,
        );
    } else if (kind === "socket") {
        compileSocket(construct);
    } else if (kind === "mcp") {
        compileMcp(construct);
    } else if (kind === "scheduler") {
        compileScheduler(construct);
    }

    const record: MountedArtifactRecord = {
        key: artifactKey({kind, name, file: options.file, package: options.package}),
        name,
        kind,
        origin: options.origin,
        construct,
        ...(options.file ? {file: options.file} : {}),
        ...(options.package ? {package: options.package} : {}),
        ...(routes ? {routes} : {}),
    };
    return ArtifactRegistry.add(record);
}
