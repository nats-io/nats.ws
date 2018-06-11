// these are emitted by the client
export const CONNECTION_REFUSED = "CONNECTION_REFUSED";
export const UNKNOWN = "UNKNOWN_ERROR";
export const CLOSED = "CLOSED";
export const BAD_SUBJECT = 'BAD_SUBJECT';
export const BAD_SUBJECT_MSG = 'Subject must be supplied';
export const CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT";
export const BAD_AUTHENTICATION = 'BAD_AUTHENTICATION';
export const BAD_AUTHENTICATION_MSG = 'User and Token can not both be provided';

// these are from the server
export const PERMISSIONS_VIOLATION = "PERMISSIONS_VIOLATION";
export const AUTHORIZATION_VIOLATION = "AUTHORIZATION_VIOLATION";
export const NATS_PROTOCOL_ERR = 'NATS_PROTOCOL_ERR';


export class NatsError extends Error {
    name: string;
    message: string;
    code: string;
    chainedError?: Error;

    /**
     * @param {String} message
     * @param {String} code
     * @param {Error} [chainedError]
     * @constructor
     *
     * @api private
     */
    constructor(message: string, code: string, chainedError?: Error) {
        super(message);
        this.name = "NatsError";
        this.message = message;
        this.code = code;
        this.chainedError = chainedError;
    }
}