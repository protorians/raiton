import ArtifactCommand from "../commands/artifact.command.ts";
import BuildCommand from "../commands/build.command.ts";
import ClientCommand from "../commands/client.command.ts";
import ContractCommand from "../commands/contract.command.ts";
import DevelopCommand from "../commands/develop.command.ts";
import DocsCommand from "../commands/docs.command.ts";
import DoctorCommand from "../commands/doctor.command.ts";
import GenerateCommand from "../commands/generate.command.ts";
import InspectCommand from "../commands/inspect.command.ts";
import McpCommand from "../commands/mcp.command.ts";
import NewCommand from "../commands/new.command.ts";
import OpenApiCommand from "../commands/openapi.command.ts";
import RoutesCommand from "../commands/routes.command.ts";
import StartCommand from "../commands/start.command.ts";
import WhyCommand from "../commands/why.command.ts";
import type {Command} from "commander";
import type {RaitonCommand} from "../core/index.ts";

export type RaitonCommandConstructor = new (cli: Command, workdir: string, appdir: string) => RaitonCommand;

export const RaitonCommandsRegistry: RaitonCommandConstructor[] = [
    NewCommand,
    GenerateCommand,
    ArtifactCommand,
    RoutesCommand,
    InspectCommand,
    WhyCommand,
    DoctorCommand,
    OpenApiCommand,
    ClientCommand,
    ContractCommand,
    McpCommand,
    DocsCommand,
    BuildCommand,
    DevelopCommand,
    StartCommand,
];
