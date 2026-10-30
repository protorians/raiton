import "reflect-metadata";
import {describe, expect, it} from "bun:test";
import {resolveArtifact} from "../source/core/controller/builder.ts";
import {METADATA_KEYS} from "../source/framework/constants/decorators.constant.ts";

const ALL = {isController: false, isSocket: false, isMcp: false, isScheduler: false};

function serverMetadata(path = "/mcp") {
    return {
        name: "named-server",
        version: "1.0.0",
        path,
        tools: [],
        prompts: [],
        resources: [],
        resourceTemplates: [],
    };
}

describe("résolution des artefacts exportés", () => {
    it("retrouve un serveur MCP exporté en nommé", () => {
        class MathServer {
            add() {
                return 1;
            }
        }

        Reflect.defineMetadata(METADATA_KEYS.MCP, serverMetadata(), MathServer.prototype);

        const artifact = resolveArtifact({MathServer}, {...ALL, isMcp: true});

        expect(artifact).toBe(MathServer);
    });

    it("retrouve un contrôleur exporté en nommé, même avec d’autres exports", () => {
        class ListUsersController {}
        class Unused {}

        Reflect.defineMetadata(METADATA_KEYS.CONTROLLERS, {prefix: "/users", routes: [], middlewares: {}}, ListUsersController.prototype);

        const artifact = resolveArtifact(
            {ListUsersController, Unused, helper: () => undefined},
            {...ALL, isController: true},
        );

        expect(artifact).toBe(ListUsersController);
    });

    it("conserve l’export default quand aucun artefact n’est décoré", () => {
        class Plain {}

        expect(resolveArtifact({default: Plain, other: 1}, {...ALL, isMcp: true})).toBe(Plain);
    });

    it("retombe sur le module importé quand aucun export n’est exploitable", () => {
        const imported = {helper: () => undefined};

        expect(resolveArtifact(imported, {...ALL, isMcp: true})).toBe(imported);
    });
});
