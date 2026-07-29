# Hot Module Replacement (HMR)

**Fichier :** `source/core/builder.ts`
**Mécanisme :** Watcher `fs.watch()` + signaux + rechargement dynamique

> **Navigation :** [← commands.md](commands.md) | [↑ cli/](README.md)

Le HMR permet de modifier le code source sans redémarrer le serveur. Activé uniquement en mode `develop`.

## Fonctionnement

```
Modification d'un fichier .ts
    │
    v
Watcher (fs.watch, recursive)
    │
    v
builder.parse(filename)
    │
    ├── isControllerArtifact(filename)
    │       → dispatch 'hmr:controller'
    │           → ControllerBuilder.build({filename, version, timestamp})
    │               → Réimporte et recompile le contrôleur
    │               → Remplace la route dans le router
    │
    └── Artifacts.is(filename)
            → Artifacts.reload(module, filename)
                → Met à jour le registre des artifacts
```

## Watcher

```typescript
// source/core/builder.ts
protected watching(): this {
  this._watcher = watch(this._source, { recursive: true }, (event, relativePath) => {
    if (this._source && relativePath) {
      this.parse(path.join(this._source, relativePath))
    }
  })
  return this
}
```

Le watcher utilise `fs.watch()` de Node.js avec l'option `recursive: true`.

## Signal HMR

```typescript
// Réception du signal (dans builder.prepare())
if (this.options.hmr && this.options.serve) {
  Raiton.signals.listen('hmr:controller', async ({filename, version, timestamp}) => {
    await ControllerBuilder.build({filename, version, timestamp})
  })
}
```

Le signal `hmr:controller` est dispatché via `Raiton.signals` (EventBus de `@protorians/events-bus`).

## Rechargement avec cache busting

Pour éviter le cache des modules ES, un paramètre de version et timestamp est ajouté à l'URL d'import :

```typescript
protected async parse(filename: string) {
  const payload = {
    filename,
    timestamp: Date.now(),
    version: this._compiledVersionNumber++,
    type,
  }

  if (isControllerArtifact(filename)) {
    Raiton.signals.dispatch('hmr:controller', payload)
  }

  if (Artifacts.is(filename))
    Artifacts.reload(
      await import(`${filename}?v=${payload.version}&t=${payload.timestamp}`),
      filename
    )
}
```

**Versionning :** `this._compiledVersionNumber` est incrémenté à chaque modification.

## Ce qui est rechargé à chaud

| Type de fichier | Comportement |
|----------------|-------------|
| `*.controller.ts` | Recompilation du contrôleur, remplacement de ses routes |
| Artifacts connus (service, socket) | Rechargement du module dans le registre |
| Autres fichiers | Ignorés (ne déclenchent pas de rechargement) |

## Exemple

```bash
# Terminal 1 : démarrage en mode dev
$ bun raiton dev
[HMR] activated
[INFO] Local access: http://localhost:3000/

# Terminal 2 : modification d'un fichier
$ echo "  @Get('/new') newRoute() { return 'ajouté à chaud' }" >> source/controllers/user.controller.ts

# Terminal 1 (automatique) :
[HMR] activated
# La nouvelle route est disponible sans redémarrage
```

## Limitations

- Le HMR ne recharge que les **contrôleurs** et les **artifacts enregistrés**
- Les modifications de **configuration** (`raiton.config.json`) nécessitent un redémarrage
- Les modifications de **middlewares globaux** (`app.use()`) nécessitent un redémarrage
- Le HMR dépend de `fs.watch` — peut ne pas fonctionner sur certains systèmes de fichiers distants (NFS, Docker volumes sur macOS)

---

[← commands.md](commands.md) | [↑ cli/](README.md)
