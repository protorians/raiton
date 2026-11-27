import "reflect-metadata";
import {Application} from "../../../../source/core/index.ts";
import {RuntimeType} from "../../../../source/framework/enums/index.ts";
import type {ThreadInterface} from "../../../../source/types/index.ts";

export default async (thread: ThreadInterface) => {
    const app = new Application({
        port: 5799,
        prefix: "/api",
    });

    return await thread.setup({
        application: app,
        runtime: RuntimeType.Bun,
    }).run();
};
