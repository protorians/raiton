import path from "node:path";
import {RaitonConfig} from "./config";
import {Raiton} from "@/core/raiton";


export class RaitonDirectories {
    public static readonly index = `.${Raiton.identifier}`;
    public static readonly bootstrapFile = 'main.js';

    public static caches(workdir: string): string {
        return path.join(workdir, this.index, 'caches');
    }

    public static artifacts(workdir: string): string {
        return path.join(workdir, this.index, 'artifacts');
    }

    public static server(workdir: string): string {
        return path.join(workdir, this.index, 'server');
    }

    public static root(workdir: string): string {
        return path.join(workdir, this.index);
    }

    public static app(){
        return path.join(Raiton.thread.builder.workdir, RaitonConfig.get('rootDir'));
    }
}