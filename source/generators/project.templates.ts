import {camel, kebab, pascal, plural} from "../bin/name-utils.ts";
import {Raiton} from "../core/raiton.ts";
import pkg from "../../package.json" with {type: "json"};

export type ProjectTemplate = "api" | "minimal" | "mcp-agent";
export type ProjectRuntime = "bun" | "node" | "deno";

export interface ProjectTemplateOptions {
    name: string;
    template: ProjectTemplate;
    runtime: ProjectRuntime;
    raitonVersion?: string;
}

export interface ProjectFile {
    path: string;
    content: string;
}

export function projectPackageJson(options: ProjectTemplateOptions): string {
    const scripts: Record<string, string> = {
        test: options.runtime === "deno"
            ? "deno test -A"
            : options.runtime === "node"
                ? "node --test"
                : "bun test",
    };

    if (options.runtime === "node") {
        scripts.dev = "raiton dev";
        scripts.build = "raiton build";
        scripts.start = "raiton start";
    } else if (options.runtime === "deno") {
        scripts.dev = "deno task dev";
        scripts.build = "deno task build";
        scripts.start = "deno task start";
    } else {
        scripts.dev = "bun raiton dev";
        scripts.build = "bun raiton build";
        scripts.start = "bun raiton start";
    }

    return JSON.stringify({
        name: kebab(options.name),
        version: "0.1.0",
        private: true,
        type: "module",
        scripts,
        dependencies: {
            [Raiton.identifier]: options.raitonVersion ?? `^${pkg.version}`,
            "reflect-metadata": "^0.2.2",
        },
        devDependencies: {
            ...(options.runtime === "bun"
                ? {"@types/bun": "^1.4.2"}
                : options.runtime === "deno"
                    ? {"@types/deno": "^2.5.0"}
                    : {"@types/node": "^25.0.3"}),
            typescript: "^5.9.0",
        },
    }, null, 2) + "\n";
}

export function projectTsconfig(runtime: ProjectRuntime): string {
    return JSON.stringify({
        compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            esModuleInterop: true,
            allowImportingTsExtensions: true,
            noEmit: true,
            skipLibCheck: true,
            resolveJsonModule: true,
            types: runtime === "bun" ? ["bun"] : runtime === "deno" ? ["deno"] : ["node"],
            baseUrl: "./",
        },
        include: ["source", "tests"],
        exclude: ["node_modules", ".raiton", "build"],
    }, null, 2) + "\n";
}

export function projectConfig(options: ProjectTemplateOptions): ProjectFile {
    const config = {
        rootDir: "./source",
        version: "0.1.0",
        port: 5711,
        hostname: "0.0.0.0",
        prefix: "/api",
        pathname: "/",
        artifacts: {types: ["controller", "service", "repository", "dto", "mcp"]},
        observability: {mode: "off"},
        validation: {responses: "auto"},
        devPage: {enabled: true},
        mcp: {exposeDestructive: false},
    };

    if (options.runtime === "bun" || options.runtime === "deno") {
        return {
            path: "raiton.config.ts",
            content: `import {defineConfigSync} from "${Raiton.identifier}/core"

export default defineConfigSync(${JSON.stringify(config, null, 2)})
`,
        };
    }

    return {
        path: "raiton.config.js",
        content: `/** @type {import("${Raiton.identifier}/types").ConfigurableInterface} */
export default ${JSON.stringify(config, null, 2)}
`,
    };
}

export function projectMain(options: ProjectTemplateOptions): string {
    const runtime = options.runtime;
    const runtimeType = runtime === "bun" ? "Bun" : runtime === "deno" ? "Deno" : "Node";
    return `import "reflect-metadata"
import {Application, RaitonConfig} from "${Raiton.identifier}/core"
import {openApiPlugin, RuntimeType} from "${Raiton.identifier}/framework"
import type {ThreadInterface} from "${Raiton.identifier}/types"

export default async (thread: ThreadInterface) => {
  const project = RaitonConfig.toObject()
  const app = new Application({
    port: project.port ?? Number(process.env.PORT ?? 5711),
    prefix: project.prefix ?? "/api",
    hostname: project.hostname,
    pathname: project.pathname,
  })

  if (process.env.NODE_ENV !== "production") {
    app.register(openApiPlugin({
      route: "/docs",
      endpoint: "/docs/json",
      title: "${pascal(options.name)} API",
      version: "0.1.0",
    }))
  }

  return await thread.setup({
    application: app,
    runtime: RuntimeType.${runtimeType},
  }).run()
}
`;
}

function exampleController(name: string): ProjectFile {
    const resource = kebab(plural(name));
    const className = `${pascal(name)}Controller`;
    return {
        path: `source/controllers/${kebab(name)}.controller.ts`,
        content: `import {Body, Controllable, Get, Post} from "${Raiton.identifier}/framework"
import {Input, Output, t} from "${Raiton.identifier}/contracts"

export const GreetingInput = t.object({
  name: t.string().min(1),
})

export type GreetingInput = t.infer<typeof GreetingInput>

export const GreetingOutput = t.object({
  message: t.string(),
})

export type GreetingOutput = t.infer<typeof GreetingOutput>

@Controllable("/${resource}")
export class ${className} {
  @Get("/")
  @Output(GreetingOutput)
  greet(): GreetingOutput {
    return {message: "Hello from Raiton"}
  }

  @Post("/")
  @Input(GreetingInput)
  @Output(GreetingOutput)
  create(@Body() input: GreetingInput): GreetingOutput {
    return {message: \`Hello \${input.name}\`}
  }
}
`,
    };
}

function exampleService(name: string): ProjectFile {
    return {
        path: `source/services/${kebab(name)}.service.ts`,
        content: `import {Injectable} from "${Raiton.identifier}/framework"

@Injectable()
export class ${pascal(name)}Service {
  private readonly greetings = new Set<string>()

  greet(name: string): string {
    this.greetings.add(name)
    return \`Hello \${name}\`
  }

  get count(): number {
    return this.greetings.size
  }
}
`,
    };
}

function mcpTest(name: string): ProjectFile {
    return {
        path: `tests/${kebab(name)}.test.ts`,
        content: `import {describe, it} from "node:test"
import assert from "node:assert/strict"
import {${pascal(name)}McpServer} from "../source/mcp/${kebab(name)}.mcp.ts"

describe("${pascal(name)}McpServer", () => {
  it("adds two numbers", () => {
    assert.deepEqual(new ${pascal(name)}McpServer().add(1, 2), {result: 3})
  })
})
`,
    };
}

function exampleTest(name: string): ProjectFile {
    return {
        path: `tests/${kebab(name)}.test.ts`,
        content: `import {describe, it} from "node:test"
import assert from "node:assert/strict"
import {${pascal(name)}Service} from "../source/services/${kebab(name)}.service.ts"

describe("${pascal(name)}Service", () => {
  it("greets and counts calls", () => {
    const service = new ${pascal(name)}Service()
    assert.equal(service.greet("Raiton"), "Hello Raiton")
    assert.equal(service.count, 1)
  })
})
`,
    };
}

function mcpServer(name: string): ProjectFile {
    return {
        path: `source/mcp/${kebab(name)}.mcp.ts`,
        content: `import {McpArg, McpServer, McpTool} from "${Raiton.identifier}/framework"
import {t} from "${Raiton.identifier}/contracts"

export const AddInput = t.object({
  a: t.number(),
  b: t.number(),
})

export type AddInput = t.infer<typeof AddInput>

export const AddOutput = t.object({
  result: t.number(),
})

export type AddOutput = t.infer<typeof AddOutput>

@McpServer({
  name: "${kebab(name)}",
  version: "1.0.0",
  description: "Example MCP server",
  path: "/mcp",
})
export class ${pascal(name)}McpServer {
  @McpTool({
    name: "add",
    description: "Add two numbers",
    inputSchema: AddInput,
    outputSchema: AddOutput,
    annotations: {readOnlyHint: true, destructiveHint: false},
  })
  add(
    @McpArg("a", "First operand", Number) a: number,
    @McpArg("b", "Second operand", Number) b: number,
  ): AddOutput {
    return {result: a + b}
  }
}
`,
    };
}

function readme(options: ProjectTemplateOptions): string {
    const resource = kebab(plural(options.name));
    const runtimeCommand = options.runtime === "bun"
        ? "bun raiton dev"
        : options.runtime === "deno"
            ? "deno task dev"
            : "npx raiton dev";

    return `# ${pascal(options.name)}

Generated with **${Raiton.identifier}** (\`${options.template}\` template, ${options.runtime} runtime).

## Start

\`\`\`bash
${runtimeCommand}
\`\`\`

${options.template === "api" ? `The example endpoint is available at:\n\n\`\`\`bash\ncurl http://localhost:5711/api/${resource}/\ncurl http://localhost:5711/api/health\n\`\`\`` : "The health endpoint is available at `http://localhost:5711/api/health`."}

## Test

\`\`\`bash
bun test
\`\`\`

## Inspect

\`\`\`bash
bun raiton inspect --json
bun raiton routes
bun raiton doctor
\`\`\`

${options.template === "mcp-agent" ? `## MCP\n\nStart the server over stdio:\n\n\`\`\`bash\nbun raiton mcp serve ${kebab(options.name)} --stdio\n\`\`\`\n` : ""}
`;
}

export function projectFiles(options: ProjectTemplateOptions): ProjectFile[] {
    const files: ProjectFile[] = [
        {path: "package.json", content: projectPackageJson(options)},
        {path: "tsconfig.json", content: projectTsconfig(options.runtime)},
        projectConfig(options),
        {path: "source/main.ts", content: projectMain(options)},
        {path: ".env.example", content: "PORT=5711\n"},
        {path: ".gitignore", content: "node_modules\n.raiton\nbuild\n.env\n"},
        {path: "README.md", content: readme(options)},
    ];

    if (options.runtime === "deno") {
        files.push({
            path: "deno.json",
            content: JSON.stringify({
                tasks: {
                    dev: `deno run -A --watch npm:${Raiton.identifier}/cli dev`,
                    build: `deno run -A npm:${Raiton.identifier}/cli build`,
                    start: `deno run -A npm:${Raiton.identifier}/cli start`,
                    test: "deno test -A",
                },
                compilerOptions: {
                    experimentalDecorators: true,
                    emitDecoratorMetadata: true,
                },
            }, null, 2) + "\n",
        });
    }

    if (options.template === "api") {
        files.push(exampleController(options.name));
        files.push(exampleService(options.name));
        files.push(exampleTest(options.name));
    }

    if (options.template === "minimal") {
        files.push(exampleService(options.name));
        files.push(exampleTest(options.name));
    }

    if (options.template === "mcp-agent") {
        files.push(mcpServer(options.name));
        files.push(mcpTest(options.name));
    }

    return files;
}

export function assertTemplate(value: string): ProjectTemplate {
    if (!["api", "minimal", "mcp-agent"].includes(value)) {
        throw new Error(`Unknown template "${value}". Expected api, minimal, or mcp-agent.`);
    }
    return value as ProjectTemplate;
}

export function assertRuntime(value: string): ProjectRuntime {
    if (!["bun", "node", "deno"].includes(value)) {
        throw new Error(`Unsupported runtime "${value}". Expected bun, node, or deno.`);
    }
    return value as ProjectRuntime;
}

export {camel, kebab, pascal, plural};
