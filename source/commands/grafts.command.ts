import {RaitonCommand} from "@/core";


export default class GraftsCommand extends RaitonCommand {

    public readonly name: string = 'grafts';
    public readonly description: string = 'Generates typings grafts';
    public readonly version: string = '0.0.1';

    public register(): void {
        this.cli
            .command("gen:grafts")
            .description("Generates typings grafts")
            .action(this.generates.bind(this))
    }

    protected async generates(): Promise<void> {
        console.log("Running grafts generator command");
        // generateArtifacts(
        //     "graft",
        //     "IGlobalGrafts",
        //     /@Graftable\(\s*(?:([A-Za-z0-9_.]+)\s*,\s*)?(?:(["'`])(.*?)\2)?\s*\)/,
        //     true,
        // )
    }

}