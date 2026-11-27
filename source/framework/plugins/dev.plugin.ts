import type {PluginInterface} from "../../types/plugin.ts";
import type {ContextInterface} from "../../types/core.ts";
import type {PluginScope} from "../../core/plugins/scope.ts";
import {generateManifest} from "../../manifest/manifest.ts";
import {generateOpenApiSpec} from "../utilities/openapi.utils.ts";
import {HealthCheckManager} from "../health-check.ts";
import {Readiness} from "../observability/readiness.ts";
import {Raiton} from "../../core/raiton.ts";
import {SchedulerManager} from "../../core/scheduler/manager.ts";

export interface DevPageOptions {
    path?: string;
    enabled?: boolean;
}

interface HmrEvent {
    time: string;
    artifact: string;
    file: string;
}

const hmrEvents: HmrEvent[] = [];

function recordHmrEvent(filename: string, artifactType?: string) {
    hmrEvents.unshift({
        time: new Date().toISOString(),
        artifact: artifactType ?? "unknown",
        file: filename,
    });
    hmrEvents.splice(25);
}

function escape(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function routesTable(routes: any[]): string {
    return routes.map(route => `<tr>
      <td><code>${escape(route.method)}</code></td>
      <td><code>${escape(route.path)}</code></td>
      <td>${escape(route.controller)}.${escape(route.handler)}</td>
      <td><code>${escape(route.file)}${route.line ? `:${route.line}` : ""}</code></td>
    </tr>`).join("");
}

function injectionList(injection: Record<string, string[]>): string {
    return Object.entries(injection).map(([name, dependencies]) => `<li><code>${escape(name)}</code>${
        dependencies.length ? ` → ${dependencies.map(dep => `<code>${escape(dep)}</code>`).join(", ")}` : ""
    }</li>`).join("");
}

function publicPath(path: string): string {
    const prefix = ((Raiton.thread?.application?.config?.prefix ?? "") as string).replace(/\/$/, "");
    return `${prefix}${path.startsWith("/") ? path : `/${path}`}`;
}

function renderPage(path: string): string {
    const manifest = generateManifest({refresh: true});
    const health = HealthCheckManager.getConfig();
    const readiness = Readiness.snapshot();
    const routes = manifest.routes;
    const manifestPath = publicPath(`${path}/manifest`);
    const schedulerJobs = SchedulerManager.current.getJobs();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Raiton — Development</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; padding: 2rem; background: #0b1020; color: #e8ecff; }
    h1 { margin: 0 0 .25rem; font-size: 1.6rem; }
    h2 { margin: 2rem 0 .75rem; font-size: 1.05rem; text-transform: uppercase; letter-spacing: .08em; color: #8ea1ff; }
    .muted { color: #94a3b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .card { background: #121936; border: 1px solid #24305e; border-radius: .8rem; padding: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    th, td { text-align: left; padding: .45rem .5rem; border-bottom: 1px solid #24305e; vertical-align: top; }
    code { background: #0b1020; padding: .1rem .3rem; border-radius: .25rem; }
    a { color: #8ea1ff; }
    button { background: #2b47b8; color: white; border: 0; border-radius: .45rem; padding: .45rem .8rem; cursor: pointer; }
    ul { margin: .25rem 0; padding-left: 1.2rem; }
    .pill { display: inline-block; padding: .1rem .45rem; border-radius: 999px; font-size: .75rem; background: ${readiness.ready ? "#14532d" : "#7f1d1d"}; }
  </style>
</head>
<body>
  <h1>Raiton development</h1>
  <p class="muted">${escape(manifest.framework.name)} ${escape(manifest.framework.version)} · runtime ${escape(manifest.runtime)} · manifest ${escape(manifest.schemaVersion)}</p>
  <p>Readiness <span class="pill">${readiness.ready ? "ready" : escape(readiness.reason ?? "not ready")}</span></p>

  <div class="grid">
    <div class="card">
      <h2 style="margin-top:0">Health</h2>
      <p class="muted">${health.enabled ? `GET ${escape(publicPath(health.path))}` : "disabled"}</p>
    </div>
    <div class="card">
      <h2 style="margin-top:0">API documentation</h2>
      <p><a href="${escape(publicPath("/docs"))}">${escape(publicPath("/docs"))}</a> · <a href="${escape(publicPath("/docs/json"))}">${escape(publicPath("/docs/json"))}</a></p>
    </div>
    <div class="card">
      <h2 style="margin-top:0">MCP</h2>
      <p>${manifest.mcp.length ? manifest.mcp.map(server => `<a href="${escape(publicPath(server.path))}">${escape(server.server)}</a>`).join(" · ") : "no server registered"}</p>
    </div>
    <div class="card">
      <h2 style="margin-top:0">Scheduler</h2>
      <p class="muted">${schedulerJobs.length} job(s) registered</p>
    </div>
    <div class="card">
      <h2 style="margin-top:0">Manifest</h2>
      <p><a href="${escape(manifestPath)}">${escape(manifestPath)}</a></p>
      <p><button id="copy">Copy manifest</button> <span id="copied" class="muted"></span></p>
    </div>
  </div>

  <h2>Routes (${routes.length})</h2>
  <table><thead><tr><th>Method</th><th>Path</th><th>Handler</th><th>Source</th></tr></thead>
  <tbody>${routesTable(routes) || `<tr><td colspan="4" class="muted">No route</td></tr>`}</tbody></table>

  <h2>Dependency injection</h2>
  <ul>${injectionList(manifest.injection) || `<li class="muted">No registered dependency</li>`}</ul>

  <h2>Artifacts</h2>
  <p>${manifest.artifacts.map(artifact => `<code>${escape(artifact)}</code>`).join(" ") || `<span class="muted">none</span>`}</p>

  <h2>Recent HMR events</h2>
  <ul>${hmrEvents.map(event => `<li>${escape(event.time)} · <code>${escape(event.artifact)}</code> · ${escape(event.file)}</li>`).join("") || `<li class="muted">No reload since start</li>`}</ul>

  <h2>Environment variables (names only)</h2>
  <p>${manifest.env.map(name => `<code>${escape(name)}</code>`).join(" ") || `<span class="muted">none detected</span>`}</p>

  <script>
    document.getElementById('copy')?.addEventListener('click', async () => {
      const response = await fetch('${escape(manifestPath)}');
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      document.getElementById('copied').textContent = 'Copied';
    });
  </script>
</body>
</html>`;
}

function routeOrigin(method: string, path: string) {
    const manifest = generateManifest({refresh: true});
    const normalized = path.replace(/\/+$/, "") || "/";
    const route = manifest.routes.find(item =>
        item.method.toUpperCase() === method.toUpperCase()
        && (item.path.replace(/\/+$/, "") || "/") === normalized
    );
    if (!route) return undefined;
    return {
        route: `${route.method} ${route.path}`,
        file: route.file,
        line: route.line,
        controller: route.controller,
        handler: route.handler,
        decorator: `@${route.method.charAt(0)}${route.method.slice(1).toLowerCase()}("${route.path}")`,
        artifact: route.controller === "Application" ? "application" : "controller",
    };
}

/**
 * Development-only page and manifest endpoint. It is mounted by `Application`
 * only when HMR/development is active, so production never exposes it.
 */
export function devPagePlugin(options: DevPageOptions = {}): PluginInterface {
    const route = options.path || "/__dev";

    return {
        name: "dev-page-plugin",
        setup: (scope: PluginScope) => {
            if (options.enabled === false) return;

            scope.get(route, async ({reply}: ContextInterface) => {
                reply.type("text/html; charset=utf-8");
                return renderPage(route);
            });

            scope.get(`${route}/manifest`, async ({reply}: ContextInterface) => {
                reply.type("application/json");
                return generateManifest({refresh: true});
            });

            scope.get(`${route}/routes`, async ({reply}: ContextInterface) => {
                reply.type("application/json");
                return generateManifest({refresh: true}).routes;
            });

            scope.get(`${route}/why`, async ({req, reply}: ContextInterface) => {
                const method = String((req as any).query?.method ?? "GET");
                const path = String((req as any).query?.path ?? req.url.split("?")[0]);
                const origin = routeOrigin(method, path);
                reply.type("application/json");
                reply.status(origin ? 200 : 404);
                return origin ?? {error: true, code: "NOT_FOUND", message: `Route ${method} ${path} not found`};
            });

            scope.get(`${route}/openapi`, async ({reply}: ContextInterface) => {
                reply.type("application/json");
                return generateOpenApiSpec(scope, {title: "API", version: "1.0.0", description: ""});
            });
        },
    };
}

let watchingHmr = false;

/** Record HMR reloads for the dev page. */
export function watchDevPageHmr(): void {
    if (watchingHmr) return;
    watchingHmr = true;
    Raiton.signals.listen("hmr:controller", async ({filename}) => recordHmrEvent(filename, "controller"));
    Raiton.signals.listen("hmr:di", async ({filename}) => recordHmrEvent(filename, "di"));
    Raiton.signals.listen("hmr:mcp", async ({filename}) => recordHmrEvent(filename, "mcp"));
}
