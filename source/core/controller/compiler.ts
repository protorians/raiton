import {ApplicationInterface} from "@/types/application";
import {getControllerMetadata} from "@/core";
import {createHandler} from "@/core/router";
import {Injection} from "@/core/injection";

export function compileController(
    ControllerClass: any,
    app: ApplicationInterface
) {
    const instance = Injection.resolve<typeof ControllerClass>(ControllerClass)
    // const instance = new ControllerClass()
    const metadata = getControllerMetadata(ControllerClass.prototype)

    for (const meta of metadata.routes) {
        app.route(
            meta.method as any,
            `${metadata.prefix ?? ''}${meta.path}`,
            createHandler(instance, meta),
        )
    }

    return instance;
}
