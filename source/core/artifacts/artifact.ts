import type {ArtifactEntry, ArtifactInterface, ArtifactOptions} from "@/types/artifact";
import {RaitonDirectories} from "@/core/directories";
import {Raiton} from "@/core/raiton";
import path from "node:path";
import fs from "node:fs";
import {LBadge, Logger} from "@protorians/logger";
import {ArtifactFactory} from "@/sdk/artifacts";
import {Throwable} from "@/sdk/throwable";

export class Artifact implements ArtifactInterface {
    public readonly directory: string;
    public readonly file: string;
    public readonly workdir: string;

    protected _files: string[] = [];

    constructor(
        public readonly options: ArtifactOptions,
    ) {
        this.options.verbose = typeof options.verbose === "undefined" ? false : options.verbose;

        if (!Raiton.thread.builder?.source)
            throw new Throwable("Artifact need project source");

        this.directory = RaitonDirectories.artifacts(Raiton.thread.builder?.workdir)
        this.workdir = Raiton.thread.builder.source;
        this.file = path.join(this.directory, `${this.options.artifact}.d.ts`);
    }

    get files(): string[] {
        return this._files;
    }

    get extensions(): string[] {
        return [
            `${this.options.artifact}.ts`,
            `${this.options.artifact}.js`,
            `${this.options.artifact}.mjs`,
            `${this.options.artifact}.cjs`,
        ]
    }

    /**
     * Finds all files with end 'artifact.EXT'
     */
    scan(): string[] {
        this._files = [];

        fs.readdirSync(this.workdir, {recursive: true})
            .forEach(f => {
                this._files = [
                    ...this._files,
                    ...this.extensions.filter(ext => f.toString().endsWith(ext))
                ];
            })
        ;

        return this._files;
    }

    generate(): boolean {
        try {
            let mappings = "";

            for (const file of this._files) {
                const filename = path.join(this.workdir, file);
                const content = fs.readFileSync(filename, "utf-8");
                const match = content.match(this.options.decorator?.syntax);

                if (!match) continue;

                let name = match[3] || match[1] || "";
                if (!name) {
                    const classMatch = content.match(/export\s+default\s+class\s+([A-Za-z0-9_]+)/);
                    name = classMatch?.[1] || path.parse(filename).name;
                }

                mappings += `    ${name}: InstanceType<typeof import("@/${file}").default>;\n`;

                if (this.options.verbose) Logger.info(LBadge.debug(name), `artifact detected`);

                ArtifactFactory.add(
                    this.options.artifact, {
                        file,
                        dir: this.workdir,
                        relative: file,
                        absolute: filename
                    }
                )
            }

            const content = `// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
declare global {
  interface ${this.options.provider} {
${mappings} }
}
export {};`;
            fs.writeFileSync(this.file, content, "utf-8");
            if (!ArtifactFactory.save(this.options.artifact))
                throw new Throwable(`Failed to save artifacts for ${this.options.artifact}`);

            return true;
        } catch (e: any) {
            Logger.error(`Failed to resolve artifacts for ${this.options.artifact}`, e.message ?? e);
        }
        return false;
    }

}