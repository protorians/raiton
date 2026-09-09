import ArtifactCommand from "../commands/artifact.command.ts";
import BuildCommand from "../commands/build.command.ts";
import DevelopCommand from "../commands/develop.command.ts";
import GraftsCommand from "../commands/grafts.command.ts";
import StartCommand from "../commands/start.command.ts";
import type {Command} from "commander";
import type {RaitonCommand} from "../core/index.ts";

export type RaitonCommandConstructor = new (cli: Command, workdir: string, appdir: string) => RaitonCommand;

export const RaitonCommandsRegistry: RaitonCommandConstructor[] = [
    ArtifactCommand,
    BuildCommand,
    DevelopCommand,
    GraftsCommand,
    StartCommand,
];