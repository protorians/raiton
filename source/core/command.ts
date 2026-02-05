import {Command} from "commander";

export class RaitonCommand {

    public readonly name: string = '';
    public readonly description?: string;
    public readonly version: string = '0.0.0';
    public readonly enabled: boolean = true;

    public constructor(
        public readonly cli: Command,
        public readonly workdir: string,
        public readonly appdir: string = ''
    ) {
        this.construct()
    }

    public construct(): void {
    }

    public register(): void {
    }

}