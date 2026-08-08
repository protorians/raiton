# Builder et Thread

**Fichiers :** `source/core/builder.ts`, `source/core/thread.ts`
**Import :** `import { RaitonBuilder, RaitonThread } from "raiton/core"`

> **Navigation :** [← config.md](config.md) | [↑ core/](README.md)

## `RaitonBuilder`

Orchestre le build et le serve de l'application.

```typescript
class RaitonBuilder {
  readonly workdir: string
  readonly options: BuilderConfigInterface
  
  source: string | null       // Dossier source (ex: ./source)
  out: string | null          // Dossier de sortie (ex: .raiton/server/)
  bootstrapper: string | null // Chemin du fichier de bootstrap
  bootstrapperFile: string | null  // Nom du fichier de bootstrap
  watcher: fs.FSWatcher | undefined  // Watcher HMR
}
```

### `builder.prepare()`

Initialise les chemins et active le HMR si demandé :

```
async prepare(): Promise<this> {
  1. initialize() → résout source, out, bootstrapper
  2. Si options.hmr && options.serve:
     - Écoute le signal 'hmr:artifact'
     - Active le watcher sur le dossier source
}
```

**Résolution des chemins :**

```typescript
source  = path.resolve(workdir, RaitonConfig.get('rootDir') || './')
out     = path.resolve(workdir, RaitonDirectories.server(workdir))  // .raiton/server/
bootstrapper = path.join(source, RaitonDirectories.bootstrapFile)    // main.ts
```

### `builder.boot()`

Point d'entrée principal. Importe le bootstrapper et exécute :

```typescript
async boot(): Promise<any> {
  1. import du bootstrapper (main.ts)
  2. Création de RaitonThread
  3. Exécution du bootstrapper → app = await bootstrapper.default(thread)
  4. Si pas en mode serve → builder.build(thread)  (compile avec tsc)
}
```

### `builder.build(thread)`

Compile l'application avec TypeScript :

```typescript
execSync(`npx tsc -p tsconfig.json --outDir ${out} --noEmit`)
```

Note : utilise `--noEmit` — la compilation réelle est faite par le script npm `build`.

### Watcher HMR

```typescript
protected watching(): this {
  this._watcher = watch(this._source, { recursive: true }, (event, relativePath) => {
    if (this._source && relativePath) {
      this.parse(path.join(this._source, relativePath))
    }
  })
}

protected async parse(filename: string) {
  if (Artifacts.is(filename) || isControllerArtifact(filename) || isSocketArtifact(filename)) {
    Raiton.signals.dispatch('hmr:artifact', {filename, ...})
  }
}
```

### Utilisation typique

```typescript
// Mode développement
const builder = new RaitonBuilder(process.cwd(), {
  serve: true,
  hmr: true,
})
await builder.prepare()
await builder.boot()

// Mode build seul
const builder = new RaitonBuilder(process.cwd())
await builder.boot()  // compile sans démarrer le serveur
```

## `RaitonThread`

Gère le cycle de vie du serveur HTTP.

```typescript
class RaitonThread {
  static current: RaitonThread | null  // Instance courante
  application: ApplicationInterface | null
  runtime: RuntimeAdapterInterface | null
  runtimeServer: RuntimeServerInterface | null
  readonly appDir: string  // process.cwd()
}
```

### `thread.setup({application, runtime})`

Configure le thread avant le démarrage :

```typescript
thread.setup({
  application: app,
  runtime: RuntimeType.Bun,  // ou RuntimeType.Node (détection auto si omis)
})

// Détection automatique :
const defaultRuntime = typeof Bun !== 'undefined' ? RuntimeType.Bun : RuntimeType.Node
```

**Effets :**
1. Crée l'adaptateur runtime (`Bun.serve` ou `node:http`)
2. Enregistre `bodyParserPlugin()` dans l'application
3. Sauvegarde la référence de l'application

### `thread.run()`

Démarre l'application :

```typescript
async run(): Promise<this> {
  1. ControllerBuilder.scan(source)  → scanne et compile les contrôleurs
  2. Si options.serve :
     - Écoute SIGINT/SIGTERM → stop()
     - Crée le serveur : runtime.createServer(application.handle)
     - Démarre l'écoute : listen(port, hostname)
     - Affiche les URLs d'accès (localhost + LAN)
}
```

### `thread.stop()`

Arrête proprement l'application :

```typescript
async stop(): Promise<void> {
  await Injection.shutdown()  // Appelle onUnmount() sur toutes les instances
  process.exit(0)
}
```

### `thread.restart()`

Envoie un signal de redémarrage au processus parent :

```typescript
restart(): void {
  process.send?.(EventMessageEnum.RESTART)
}
```

### `thread.sleep(ms)` / `thread.wait(condition)`

Utilitaires d'attente :

```typescript
await thread.sleep(1000)  // Attend 1 seconde
await thread.wait(() => fileExists)  // Attend qu'une condition soit vraie
```

### Accès statique

```typescript
if (RaitonThread.current) {
  console.log("Thread actif")
}
```

## Exemple complet : cycle de vie

```typescript
import "reflect-metadata"
import { Application, RaitonBuilder, RaitonThread } from "raiton/core"
import { ThreadInterface } from "raiton/types"

// 1. Définition du bootstrapper (source/main.ts)
export default async function (thread: ThreadInterface) {
  const app = new Application({ port: 3000 })
  return await thread.setup({ application: app }).run()
}
```

```typescript
// 2. Ce qu'il se passe dans le CLI
const builder = new RaitonBuilder(process.cwd(), {
  serve: true,
  hmr: true,  // Mode dev
})

await builder.prepare()
// → RaitonConfig.sync()
// → Résout source, out, bootstrapper
// → Active le watcher

await builder.boot()
// → Import de main.ts
// → RaitonThread créé
// → bootstrapper.default(thread)
//   → new Application()
//   → thread.setup({ application })
//   → thread.run()
//     → ControllerBuilder.scan()
//   → HTTP Server listen(3000)
```

---

[← config.md](config.md) | [↑ core/](README.md)
