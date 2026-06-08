import {ApplicationInterface} from "../../types/application";
import {getControllerMetadata} from "..";
import {createHandler} from "../router";
import {Injection} from "../injection";
import {ControllerMetaInterface} from "../../types";

export function compileController(
    ControllerClass: any,
    app: ApplicationInterface
) {
    const instance: any = Injection.resolve<typeof ControllerClass>(ControllerClass)
    const metadata: ControllerMetaInterface = getControllerMetadata(ControllerClass.prototype)

    for (const route of metadata.routes)
        app.route(
            route.method as any,
            `${metadata.prefix ?? ''}${route.path}`,
            createHandler(instance, route, metadata),
        )

    return instance;
}
