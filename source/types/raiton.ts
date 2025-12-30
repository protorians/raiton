import {BuilderHMRDeclaration} from "@/types/builder";
import {Metafile} from "esbuild";

export interface RaitonSignalMap {
    ready?: undefined;
    errors: any;
    'hmr:controller': BuilderHMRDeclaration;
    'hmr:triggered': Metafile | undefined;
}