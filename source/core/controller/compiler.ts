import {ApplicationInterface} from "../../types/application.ts";
import {getControllerMetadata} from "../index.ts";
import {createHandler} from "../router/index.ts";
import {Injection} from "../injection/index.ts";
import {ControllerMetaInterface} from "../../types/index.ts";
import {ControllerRouteTracker} from "./tracker.ts";

export function compileController(
    ControllerClass: any,
    app: ApplicationInterface
) {
    const instance: any = Injection.resolve<typeof ControllerClass>(ControllerClass)
    const metadata: ControllerMetaInterface = getControllerMetadata(ControllerClass.prototype)
    const name = ControllerClass.name

    const rootScope = (app as any).root
    if (rootScope?.router) {
        ControllerRouteTracker.removeRoutes(name, rootScope.router)
    }

    const routes: any[] = []
    for (const route of metadata.routes) {
        const registered = app.route(
            route.method as any,
            `${metadata.prefix ?? ''}${route.path}`,
            createHandler(instance, route, metadata),
        )
        routes.push(registered)
    }

    ControllerRouteTracker.setRoutes(name, routes)
    return instance;
}
