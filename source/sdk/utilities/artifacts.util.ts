import path from "node:path";
import fs from "fs";
import {LBadge, Logger} from "@protorians/logger";
import {RaitonDirectories} from "@/core";
import {Raiton} from "@/core/raiton";
import {ArtifactFactory} from "@/sdk/artifacts";


export function generateArtifacts(
    artifact: string,
    interfaceName: string,
    decoratorSyntax: RegExp,
    verbose: boolean = false,
) {
    const artifacts = RaitonDirectories.artifacts(Raiton.thread.builder.workdir)
    const dir = Raiton.thread.builder.source;
    const outputFile = path.join(artifacts, `${artifact}.d.ts`);

    if (!dir) return;

    const files = fs.readdirSync(dir, {recursive: true})
        .filter(f => [`.ts`, `.js`, `.mjs`, `.cjs`,].some(ext => f.toString().endsWith(ext)))
        .map(f => f.toString())
    ;

    let mappings = "";
    for (const file of files) {

        const filename = path.join(dir, file);
        const content = fs.readFileSync(filename, "utf-8");
        const match = content.match(decoratorSyntax);

        if (!match) continue;

        let name = match[3] || match[1] || "";
        if (!name) {
            const classMatch = content.match(/export\s+default\s+class\s+([A-Za-z0-9_]+)/);
            name = classMatch?.[1] || path.parse(filename).name;
        }

        mappings += `    ${name}: InstanceType<typeof import("@/${file}").default>;\n`;

        if (verbose) Logger.info(LBadge.debug(name), `artifact detected`);
        ArtifactFactory.add(artifact, {
            file,
            dir,
            relative: file,
            absolute: filename
        })
    }

    const content = `// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
declare global {
  interface ${interfaceName} {
${mappings} }
}
export {};`;
    fs.writeFileSync(outputFile, content, "utf-8");
    if (!ArtifactFactory.save(artifact)) Logger.error(`Failed to save artifacts for ${artifact}`);
}


