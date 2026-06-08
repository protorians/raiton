import {BuilderHMRDeclarationInterface} from "./builder";

export interface RaitonSignalMapInterface {
    ready?: undefined;
    errors: any;
    'hmr:controller': BuilderHMRDeclarationInterface;
}