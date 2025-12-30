import path from "node:path";
import * as fs from "node:fs";
import {FastifyInstance} from "fastify";
import {aliasPath} from "./utilities";


export async function registryRoutes(app: FastifyInstance) {
    const dir = aliasPath('@/routes');
    if (!dir || !fs.existsSync(dir)) return app;

    const files = fs.readdirSync(dir);

    for (const file of files) {
        if (file.endsWith(".route.ts")) {
            const route = await import(path.join(dir, file));
            route.default(app);
        }
    }

    return app;
}