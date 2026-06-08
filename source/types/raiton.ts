import {BuilderHMRDeclaration} from "./builder";

export interface RaitonSignalMap {
    ready?: undefined;
    errors: any;
    'hmr:controller': BuilderHMRDeclaration;
}