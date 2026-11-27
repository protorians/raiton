import {camel, kebab, pascal, plural} from "../bin/name-utils.ts";
import {Raiton} from "../core/raiton.ts";

export type ArtifactType = "controller" | "service" | "repository" | "dto" | "mcp-tool" | "test" | "resource";

export interface ArtifactFile {
    path: string;
    content: string;
}

function controllerFile(name: string, withService = false): ArtifactFile {
    const className = `${pascal(name)}Controller`;
    const route = `/${kebab(plural(name))}`;
    const serviceImport = withService
        ? `import {Create${pascal(name)}} from "../dtos/${kebab(name)}.dto"\nimport {${pascal(name)}Service} from "../services/${kebab(name)}.service"\n`
        : "";
    const constructor = withService
        ? `  constructor(private readonly service: ${pascal(name)}Service) {}\n\n`
        : "";
    const listBody = withService
        ? "return this.service.list()"
        : "return []";
    const createRoute = withService
        ? `
  @Post("/")
  @Input(Create${pascal(name)})
  create(@Body() input: Create${pascal(name)}) {
    return this.service.create(input)
  }
`
        : "";

    return {
        path: `source/controllers/${kebab(name)}.controller.ts`,
        content: `import {${withService ? "Body, " : ""}Controllable, Get, Post} from "${Raiton.identifier}/framework"
${withService ? `import {Input} from "${Raiton.identifier}/contracts"\n` : ""}${serviceImport}
@Controllable("${route}")
export class ${className} {
${constructor}  @Get("/")
  list() {
    ${listBody}
  }
${createRoute}}
`,
    };
}

function serviceFile(name: string, withRepository = false): ArtifactFile {
    const className = `${pascal(name)}Service`;
    const repositoryImport = withRepository
        ? `import type {Create${pascal(name)}} from "../dtos/${kebab(name)}.dto"\nimport {${pascal(name)}Repository} from "../repositories/${kebab(name)}.repository"\n`
        : "";
    const constructor = withRepository
        ? `  constructor(private readonly repository: ${pascal(name)}Repository) {}\n\n`
        : "";
    const methods = withRepository
        ? `  list() {
    return this.repository.list()
  }

  create(input: Create${pascal(name)}) {
    return this.repository.save({id: crypto.randomUUID(), name: input.name})
  }
`
        : `  private readonly items: string[] = []

  list(): string[] {
    return [...this.items]
  }

  add(value: string): string {
    this.items.push(value)
    return value
  }
`;

    return {
        path: `source/services/${kebab(name)}.service.ts`,
        content: `import {Injectable} from "${Raiton.identifier}/framework"
${repositoryImport}
@Injectable()
export class ${className} {
${constructor}${methods}}
`,
    };
}

function repositoryFile(name: string): ArtifactFile {
    return {
        path: `source/repositories/${kebab(name)}.repository.ts`,
        content: `import {Injectable} from "${Raiton.identifier}/framework"

export interface ${pascal(name)}Record {
  id: string
  name: string
}

@Injectable()
export class ${pascal(name)}Repository {
  private readonly items = new Map<string, ${pascal(name)}Record>()

  list(): ${pascal(name)}Record[] {
    return [...this.items.values()]
  }

  find(id: string): ${pascal(name)}Record | undefined {
    return this.items.get(id)
  }

  save(record: ${pascal(name)}Record): ${pascal(name)}Record {
    this.items.set(record.id, record)
    return record
  }
}
`,
    };
}

function dtoFile(name: string): ArtifactFile {
    const typeName = pascal(name).startsWith("Create") ? pascal(name) : `Create${pascal(name)}`;
    return {
        path: `source/dtos/${kebab(name)}.dto.ts`,
        content: `import {t} from "${Raiton.identifier}/contracts"

export const ${typeName} = t.object({
  name: t.string().min(1),
})

export type ${typeName} = t.infer<typeof ${typeName}>
`,
    };
}

function mcpToolFile(name: string): ArtifactFile {
    const toolName = camel(name);
    const className = `${pascal(name)}McpServer`;
    return {
        path: `source/mcp/${kebab(name)}.mcp.ts`,
        content: `import {McpArg, McpServer, McpTool} from "${Raiton.identifier}/framework"

@McpServer({
  name: "${kebab(name)}",
  version: "1.0.0",
  description: "${pascal(name)} tool server",
  path: "/mcp",
})
export class ${className} {
  @McpTool({
    name: "${toolName}",
    description: "Generated ${toolName} tool",
    annotations: {readOnlyHint: false, destructiveHint: false},
  })
  ${toolName}(@McpArg("value", "Input value", String) value: string) {
    return {value, ok: true}
  }
}
`,
    };
}

function testFile(name: string, withRepository = false): ArtifactFile {
    if (withRepository) {
        return {
            path: `tests/${kebab(name)}.test.ts`,
            content: `import {describe, it} from "node:test"
import assert from "node:assert/strict"
import {${pascal(name)}Repository} from "../source/repositories/${kebab(name)}.repository.ts"
import {${pascal(name)}Service} from "../source/services/${kebab(name)}.service.ts"

describe("${pascal(name)}Service", () => {
  it("creates and lists records", () => {
    const service = new ${pascal(name)}Service(new ${pascal(name)}Repository())
    const created = service.create({name: "Raiton"})
    assert.equal(created.name, "Raiton")
    assert.equal(service.list().length, 1)
  })
})
`,
        };
    }

    return {
        path: `tests/${kebab(name)}.test.ts`,
        content: `import {describe, it} from "node:test"
import assert from "node:assert/strict"
import {${pascal(name)}Service} from "../source/services/${kebab(name)}.service.ts"

describe("${pascal(name)}Service", () => {
  it("stores a value", () => {
    const service = new ${pascal(name)}Service()
    assert.equal(service.add("raiton"), "raiton")
    assert.deepEqual(service.list(), ["raiton"])
  })
})
`,
    };
}

export function artifactFiles(type: ArtifactType, name: string): ArtifactFile[] {
    switch (type) {
        case "controller":
            return [controllerFile(name)];
        case "service":
            return [serviceFile(name)];
        case "repository":
            return [repositoryFile(name)];
        case "dto":
            return [dtoFile(name)];
        case "mcp-tool":
            return [mcpToolFile(name)];
        case "test":
            return [testFile(name)];
        case "resource":
            return [
                dtoFile(name),
                repositoryFile(name),
                serviceFile(name, true),
                controllerFile(name, true),
                testFile(name, true),
            ];
    }
}

export function assertArtifactType(value: string): ArtifactType {
    const allowed: ArtifactType[] = ["controller", "service", "repository", "dto", "mcp-tool", "test", "resource"];
    if (!allowed.includes(value as ArtifactType)) {
        throw new Error(`Unknown generator "${value}". Expected ${allowed.join(", ")}.`);
    }
    return value as ArtifactType;
}
