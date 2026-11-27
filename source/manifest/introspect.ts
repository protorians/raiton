import {RaitonBuilder} from "../core/builder.ts";
import {RaitonThread} from "../core/thread.ts";
import {Raiton} from "../core/raiton.ts";
import {RaitonConfig} from "../core/config/config.ts";
import type {ApplicationInterface} from "../types/application.ts";
import {generateManifest, type GenerateManifestOptions} from "./manifest.ts";
import {type ProjectManifest, validateManifest} from "./schema.ts";
import {setDebugContext} from "../debug/runtime.ts";

export interface Introspection {
    builder: RaitonBuilder;
    thread: RaitonThread;
    application: ApplicationInterface;
    manifest: ProjectManifest;
    validation: ReturnType<typeof validateManifest>;
}

/**
 * Boot a project without opening a listening socket. The project's own
 * bootstrapper is used so routes, DI and configuration are exactly those of the
 * application, then a manifest is generated from the live registries.
 */
export async function introspectProject(
    workdir = process.cwd(),
    options: GenerateManifestOptions = {},
): Promise<Introspection> {
    await RaitonConfig.sync(workdir, {force: true});

    RaitonThread.reset();
    Raiton.resetThread();

    const builder = new RaitonBuilder(workdir, {serve: false, hmr: false, compile: false});
    await builder.prepare();
    await builder.boot();

    const thread = RaitonThread.current;
    const application = thread?.application;
    if (!thread || !application) {
        throw new Error(
            `No application was created by ${builder.bootstrapper ?? "the bootstrapper"}. ` +
            `Ensure its default export calls thread.setup({ application }).run().`
        );
    }

    // CLI introspection knows the project root even when the bootstrapper did
    // not pass it to the Application: align debug session paths.
    setDebugContext({workdir, application});

    const manifest = generateManifest({workdir, refresh: true, ...options});
    return {
        builder,
        thread,
        application,
        manifest,
        validation: validateManifest(manifest),
    };
}
