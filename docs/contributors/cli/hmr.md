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
    └── dispatch 'hmr:artifact'
            ├── si contrôleur / socket → ControllerBuilder.build({filename, version, timestamp})
            └── sinon → Artifacts.reload(module, filename)
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
  Raiton.signals.listen('hmr:artifact', async ({filename, version, timestamp}) => {
    const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
    if (isControllerArtifact(filename) || isSocketArtifact(filename)) {
      await ControllerBuilder.build({filename, version, timestamp})
      return
    }

    Artifacts.reload(imported, filename)
  })
}
```

Le signal `hmr:artifact` est le seul point d'entrée du HMR côté runtime. Le type de fichier est résolu localement.

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

  if (Artifacts.is(filename) || isControllerArtifact(filename) || isSocketArtifact(filename)) {
    Raiton.signals.dispatch('hmr:artifact', payload)
  }
}
```

**Versionning :** `this._compiledVersionNumber` est incrémenté à chaque modification.

## Ce qui est rechargé à chaud

| Type de fichier | Comportement |
|----------------|-------------|
| `*.controller.ts` / `*.controller.js` | Recompilation du contrôleur via `ControllerBuilder.build()` |
| `*.socket.ts` / `*.socket.js` | Recompilation du socket via `ControllerBuilder.build()` |
| Tous les artifacts listés dans `Artifacts.defaultTypes` | Rechargement du module dans le registre |
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

- Le HMR ne passe que par `hmr:artifact`
- Les contrôleurs et sockets sont rechargés via le même signal, mais traités selon leur suffixe
- Les modifications de **configuration** (`raiton.config.json`) nécessitent un redémarrage
- Les modifications de **middlewares globaux** (`app.use()`) nécessitent un redémarrage
- Le HMR dépend de `fs.watch` — peut ne pas fonctionner sur certains systèmes de fichiers distants (NFS, Docker volumes sur macOS)

---

[← commands.md](commands.md) | [↑ cli/](README.md)
