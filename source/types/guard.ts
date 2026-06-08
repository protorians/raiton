export interface GuardDeclarationInterface {
    credential?: boolean;
    capabilities?: string[];
}

export interface GuardInterface {
    handle(credential: string, capabilities: string[]): Promise<boolean>;
}
