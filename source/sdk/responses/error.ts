import type {ErrorResponseInterface} from "../../types";
import {HttpResponse} from "./http";


export class HttpErrorResponse {
    public readonly stack: Map<string, ErrorResponseInterface> = new Map();

    public get entries(): ErrorResponseInterface[] {
        return [...this.stack.values()];
    }

    public add(input: ErrorResponseInterface): this {
        this.stack.set(input.id, input)
        return this;
    }

    public remove(id: string): this {
        this.stack.delete(id);
        return this;
    }

    public get(id: string): ErrorResponseInterface | undefined {
        return this.stack.get(id);
    }

    public has(id: string): boolean {
        return this.stack.has(id);
    }

    public clear(): this {
        this.stack.clear();
        return this;
    }

    public get empty(): boolean {
        return this.stack.size === 0;
    }

    public get existence(): number {
        return this.stack.size
    }

    public push() {
        const first = this.stack.values().next().value;
        HttpResponse.push({
            statusCode: 500,
            message: first?.message || 'Internal server error',
            error: true,
            errorStack: this.entries
        })
    }
}