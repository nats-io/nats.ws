/*
 * Copyright 2018-2020 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {ConnectionOptions} from "./nats"
import {ErrorCode, NatsError} from "./error"

const ARRAY_BUFFER = "arraybuffer"

export interface Transport {
    isConnected(): boolean;

    isClosed(): boolean;

    write(data: any): void;

    destroy(): void;

    close(): void;

    isSecure(): boolean;
}

export interface CloseHandler {
    (evt: CloseEvent): void;
}

export interface EventHandler {
    (evt: Event): void;
}

export interface MessageHandler {
    (evt: MessageEvent): void;
}


export interface TransportHandlers {
    openHandler: EventHandler;
    closeHandler: CloseHandler;
    errorHandler: EventHandler;
    messageHandler: MessageHandler;
}

export class WSTransport {
    stream: WebSocket | null = null;
    handlers: TransportHandlers;
    closed: boolean = false;
    debug: boolean = false;
    listeners: TransportHandlers = {} as TransportHandlers;

    constructor(handlers: TransportHandlers) {
        this.handlers = handlers;
    }

    static connect(options: ConnectionOptions, handlers: TransportHandlers, debug: boolean = false): Promise<Transport> {
        return new Promise((resolve, reject) => {
            let transport = new WSTransport(handlers)
            transport.debug = debug

            // on browsers, new WebSocket will fail with an exception
            // no catch will get the error, just a console error message
            // tests are more amazing and provide nothing.
            transport.stream = new WebSocket(options.url)
            transport.stream.binaryType = ARRAY_BUFFER
            transport.listeners = {} as TransportHandlers

            // while the promise resolves, we need to trap any errors/close
            // related to the connection process and handle via the
            // resolve/reject - generate some handlers, and store them
            // so they can be removed.
            let connected: boolean;
            let resolveTimeout: number;
            transport.stream.onclose = function (evt: CloseEvent) {
                // transport.trace('ws closed', evt);
                if (transport.closed) {
                    return;
                }
                if (connected) {
                    transport.handlers.closeHandler(evt);
                    transport.close();
                } else {
                    clearTimeout(resolveTimeout);
                    reject(NatsError.errorForCode(ErrorCode.CONNECTION_CLOSED));
                }
            };

            transport.stream.onerror = function (evt: Event) {
                let err;
                if (evt) {
                    err = (evt as ErrorEvent).error;
                    if (!err) {
                        let m = (evt as ErrorEvent).message;
                        if (!m) {
                            if (!connected) {
                                err = NatsError.errorForCode(ErrorCode.CONNECTION_REFUSED);
                            } else {
                                err = NatsError.errorForCode(ErrorCode.UNKNOWN);
                            }
                        } else {
                            err = new NatsError(m, ErrorCode.UNKNOWN);
                        }
                    }
                }
                // transport.trace('ws error', err);
                if (transport.closed) {
                    return;
                }
                if (transport) {
                    transport.close();
                }
                if (connected) {
                    transport.handlers.errorHandler(evt);
                } else {
                    reject(err);
                }
            };

            transport.stream.onopen = function () {
                // transport.trace('ws open');
                // we cannot resolve immediately! we connected to
                // a proxy which is establishing a connection to NATS,
                // that can fail - wait for data to arrive.
            };

            transport.stream.onmessage = function (me: MessageEvent) {
                // transport will resolve as soon as we get data as the
                // proxy has connected to a server
                // transport.trace('>', [me.data]);
                if (connected) {
                    transport.handlers.messageHandler(me);
                } else {
                    connected = true
                    resolve(transport)
                    if (typeof module !== 'undefined' && module.exports) {
                        // we are running under node, so we handle the resolution differently
                        setTimeout(() => {
                            transport.handlers.messageHandler(me)
                        }, 0)
                    } else {
                        transport.handlers.messageHandler(me)
                    }
                }
            };
        });
    };

    isClosed(): boolean {
        return this.closed;
    }

    isConnected(): boolean {
        return this.stream !== null && this.stream.readyState === WebSocket.OPEN;
    }

    write(data: ArrayBuffer): void {
        if (!this.stream || !this.isConnected()) {
            return;
        }
        // this.trace('<', [data]);
        this.stream.send(data);

    }

    destroy(): void {
        if (!this.stream) {
            return;
        }
        if (this.closed) {
            this.stream.onclose = null;
            this.stream.onerror = null;
            this.stream.onopen = null;
            this.stream.onmessage = null;
        }
        if (this.stream.readyState !== WebSocket.CLOSED && this.stream.readyState !== WebSocket.CLOSING) {
            this.stream.close(1000);
        }
        this.stream = null;
    }

    close(): void {
        this.closed = true;
        if (this.stream && this.stream.bufferedAmount > 0) {
            setTimeout(this.close.bind(this), 100);
            return;
        }
        this.destroy();
    }

    trace(...args: any[]): void {
        if (this.debug) {
            console.log(args);
        }
    }

    isSecure(): boolean {
        if (this.stream) {
            let protocol = new URL(this.stream.url).protocol;
            return protocol.toLowerCase() === "wss:";
        }
        return false;
    }
}