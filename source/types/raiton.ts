import {BuilderHMRDeclaration} from "@/types/builder";

export interface RaitonSignalMap {
    ready?: undefined;
    errors: any;
    'hmr:controller': BuilderHMRDeclaration;
}