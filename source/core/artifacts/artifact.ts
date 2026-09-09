import {RaitonConfig} from "../config/config.ts";

export class Artifact {

    public static async load(workdir: string) {
        await RaitonConfig.sync(workdir);
        return RaitonConfig.get('artifacts');
    }

}