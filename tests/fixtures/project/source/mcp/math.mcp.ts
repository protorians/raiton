import {
    McpArg,
    McpServer,
    McpTool,
} from "../../../../../source/framework/index.ts";

@McpServer({
    name: "math",
    version: "1.0.0",
    path: "/mcp",
    description: "Fixture MCP server",
})
export class MathServer {
    @McpTool({
        name: "add",
        description: "Add two numbers",
        annotations: {readOnlyHint: true, destructiveHint: false},
    })
    add(
        @McpArg("a", "First operand", Number) a: number,
        @McpArg("b", "Second operand", Number) b: number,
    ) {
        return {result: a + b};
    }

    @McpTool({
        name: "drop",
        description: "Destructive tool",
        annotations: {readOnlyHint: false, destructiveHint: true},
    })
    drop() {
        return {dropped: true};
    }
}
