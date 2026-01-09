import {RaitonConfig} from "@/core";

export class Artifacts {

    public static async load(workdir: string) {
        await RaitonConfig.sync(workdir);
        return RaitonConfig.get('artifacts');
    }

}