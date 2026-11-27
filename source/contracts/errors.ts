import type {ContractIssue} from "./schema.ts";

export const DOCS_BASE_URL = "https://github.com/protorians/raiton/blob/main/docs";

export function docsUrl(path = "user-guide/README.md"): string {
    return `${DOCS_BASE_URL}/${path.replace(/^\//, "")}`;
}

export interface ValidationErrorBody {
    error: true;
    code: "VALIDATION_ERROR";
    message: string;
    statusCode: number;
    details: ContractIssue[];
    docsUrl: string;
}

/**
 * Stable validation error payload shared by runtime validation and generated
 * clients. Never includes a stack trace or internal field.
 */
export function validationErrorBody(
    issues: ContractIssue[],
    message = "Invalid request",
): ValidationErrorBody {
    return {
        error: true,
        code: "VALIDATION_ERROR",
        message,
        statusCode: 400,
        details: issues,
        docsUrl: docsUrl("user-guide/recipes/contracts.md"),
    };
}

/**
 * Thrown before the route handler executes when the input contract fails.
 */
export class ContractValidationError extends Error {
    public readonly statusCode = 400;

    constructor(public readonly issues: ContractIssue[], message = "Invalid request") {
        super(message);
        this.name = "ContractValidationError";
    }

    render() {
        return validationErrorBody(this.issues, this.message);
    }
}

/**
 * Thrown in development when a response does not match its `@Output` contract.
 */
export class OutputContractError extends Error {
    public readonly statusCode = 500;

    constructor(
        public readonly route: string,
        public readonly issues: ContractIssue[],
    ) {
        super(`Response contract violation on ${route}`);
        this.name = "OutputContractError";
    }

    render() {
        return {
            error: true,
            code: "OUTPUT_VALIDATION_ERROR",
            statusCode: 500,
            message: `Response contract violation on ${this.route}`,
            details: this.issues,
            docsUrl: docsUrl("user-guide/recipes/contracts.md"),
        };
    }
}
