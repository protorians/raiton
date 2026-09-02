import {BuilderHMRDeclarationInterface} from "./builder";

export interface RaitonSignalMapInterface {
    ready?: undefined;
    errors: any;
    'hmr:artifact': BuilderHMRDeclarationInterface;
    'hmr:di': BuilderHMRDeclarationInterface;
    'hmr:controller': BuilderHMRDeclarationInterface;
    'hmr:socket': BuilderHMRDeclarationInterface;
    'hmr:middleware': BuilderHMRDeclarationInterface;
    'hmr:hook': BuilderHMRDeclarationInterface;
    'hmr:mcp': BuilderHMRDeclarationInterface;
}
