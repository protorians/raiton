# Recette — MCP HTTP et stdio

**Objectif** : servir les mêmes outils sur les deux transports, avec default-deny sur les outils destructifs.

```ts
@McpServer({name: "math", path: "/mcp"})
export class MathServer {
  @McpTool({name: "add", annotations: {readOnlyHint: true}})
  add(@McpArg("a", "First", Number) a: number, @McpArg("b", "Second", Number) b: number) {
    return {result: a + b}
  }

  @McpTool({name: "drop", annotations: {destructiveHint: true}})
  drop() {
    return {dropped: true}
  }
}
```

**Commandes**

```bash
raiton mcp list --json
raiton mcp inspect math --json
raiton mcp test math.add --args '{"a":1,"b":2}' --json
raiton mcp serve math --stdio
raiton mcp conformance math --json
```

**Attendu**

- `tools/list` contient `add`, pas `drop`.
- `tools/call` sur `drop` retourne `Tool not found`.
- HTTP et stdio passent la même suite de conformité.
- Les journaux d'audit vont sur stderr et les secrets sont expurgés.
