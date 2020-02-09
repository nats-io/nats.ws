export interface Base {
    subject: string;
    callback: MsgCallback;
    received: number;
    timeout?: number | null;
    max?: number | undefined;
    draining: boolean;
}

export interface ConnectionOptions {
    connectTimeout?: number;
    name?: string;
    noEcho?: boolean;
    pass?: string;
    payload?: Payload;
    pedantic?: boolean;
    token?: string;
    url: string;
    user?: string;
    userJWT?: string | JWTProvider;
    verbose?: boolean;
}

export interface Callback {
    (): void;
}

export interface ErrorCallback {
    (error: Error): void;
}

export interface ClientEventMap {
    close: Callback;
    error: ErrorCallback;
}

export interface ClientHandlers {
    closeHandler: Callback;
    errorHandler: ErrorCallback;
}

export interface Msg {
    subject: string;
    sid: number;
    reply?: string;
    size: number;
    data?: any;
}

export interface MsgCallback {
    (msg: Msg): void;
}

export enum Payload {
    STRING = "string",
    JSON = "json",
    BINARY = "binary"
}

export interface RequestOptions {
    timeout?: number;
}

export interface Req extends Base {
    token: string;
}

export interface Sub extends Base {
    sid: number;
    queue?: string | null;
}

export interface SubscribeOptions {
    queue?: string;
    max?: number;
}

export interface JWTProvider {
    (): string;
}
