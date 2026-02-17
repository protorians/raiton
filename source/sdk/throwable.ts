import {LBadge, Logger} from "@protorians/logger";
import {EventBus, EventBusEnum} from "@protorians/events-bus";

/**
 * Represents a throwable error that extends the built-in JavaScript Error class.
 * The Throwable class provides utility methods for triggering different levels
 * of error notifications, including error, warning, and critical errors.
 *
 * The class dispatches error notifications via the EventBus and optionally
 * throws an exception or exits the application depending on the severity level
 * or the provided parameters.
 */
export class Throwable extends Error {
    constructor(message: string, protected statusCode: number = 500, label?: string) {
        super(message);
        this.name = 'Throwable';
        if (label) Logger.debug(LBadge.debug(label), message);
        EventBus.dispatch(EventBusEnum.SERVER_THROW, {error: this})
    }

    /**
     * Dispatches a system server error event and optionally throws an error.
     *
     * @param {string} message - The error message to be dispatched and potentially thrown.
     * @param {boolean} [soft=true] - Determines whether the error should be thrown. If true, the error is only dispatched. If false, the error is dispatched and then thrown.
     * @param statusCode
     * @return {void} This method does not return a value.
     */
    static error(message: string, soft: boolean = true, statusCode: number = 500): void {
        EventBus.dispatch(EventBusEnum.SERVER_ERROR, {message, soft})
        if (!soft) throw new Throwable(message, statusCode, 'ERR');
    }

    /**
     * Emits a system server warning event and optionally throws an error based on the severity of the warning.
     *
     * @param {string} message - The warning message to be dispatched and possibly thrown as an error.
     * @param {boolean} [soft=true] - Determines whether the warning should be treated as non-critical (soft). If false, an error is thrown.
     * @param statusCode
     * @return {void} This method does not return a value.
     */
    static warning(message: string, soft: boolean = true, statusCode: number = 500): void {
        EventBus.dispatch(EventBusEnum.SERVER_WARNING, {message, soft})
        if (!soft) throw new Throwable(message, statusCode, 'WRN');
    }

    /**
     * Triggers a critical system event, dispatching an alert message and terminating the process.
     *
     * @param {string} message - The critical error message to be dispatched with the event.
     * @return {void} This method does not return a value as it terminates the process.
     */
    static critical(message: string): void {
        Logger.debug(LBadge.debug('CRITICAL'), message);
        EventBus.dispatch(EventBusEnum.SERVER_CRITICAL, {message})
        process.exit(1);
    }
}

/**
 * A function that throws an error with a provided message and a specified error type.
 *
 * @param {string} message - The error message to be used when throwing the error.
 * @param {boolean} [soft=true] - Determines whether the error is categorized as "soft".
 *                                 If true, it will be treated as a soft error. Defaults to true.
 * @param statusCode
 * @returns {void}
 */
export const throwError = (message: string, soft: boolean = true, statusCode: number = 500): void => Throwable.error(message, soft, statusCode);

/**
 * Function to throw an error with a specified message.
 *
 * @param {string} message - The error message to be used in the thrown error.
 * @param statusCode
 * @throws {Throwable} always throw an error with the provided message.
 */
export const throwException = (message: string, statusCode: number = 500): void => throwError(message, false, statusCode);

/**
 * Emits a warning with the specified message and behavior.
 *
 * @param {string} message - The warning message to be displayed.
 * @param {boolean} [soft=true] - Indicates whether the warning should be soft (true)
 * or treated as a harder warning (false). Defaults to true.
 * @param statusCode
 * @returns {void} This function does not return any value.
 */
export const throwWarning = (message: string, soft: boolean = true, statusCode: number = 500): void =>
    Throwable.warning(message, soft, statusCode);

/**
 * A variable representing a function that throws a critical error.
 *
 * This function is used to trigger a critical error by providing a specific message.
 * It encapsulates the logic for generating a throwable critical error through the `Throwable.critical` method.
 *
 * @param {string} message - The error message describing the critical error to be thrown.
 * @returns {Throwable} The critical throwable generated with the provided message.
 */
export const throwCritical = (message: string): void => Throwable.critical(message);
