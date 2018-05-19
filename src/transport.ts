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

    static connect(url: URL, handlers: TransportHandlers, debug: boolean = false): Promise<Transport> {
        return new Promise((resolve, reject) => {
            let transport = new WSTransport(handlers);
            transport.debug = debug;
            transport.stream = new WebSocket(url.toString());
            transport.listeners = {} as TransportHandlers;

            // while the promise resolves, we need to trap any errors/close
            // related to the connection process and handle via the
            // resolve/reject - generate some handlers, and store them
            // so they can be removed.
            let connected: boolean;
            let resolveTimeout: number;
            transport.stream.onclose = function (evt: CloseEvent) {
                transport.trace('ws closed', evt);
                if (transport.closed) {
                    return;
                }
                if (connected) {
                    transport.handlers.closeHandler(evt);
                    transport.close();
                } else {
                    clearTimeout(resolveTimeout);
                    reject(new Error('closed'));
                }
            };

            transport.stream.onerror = function (evt: Event) {
                let err;
                if (evt) {
                    err = (evt as ErrorEvent).error;
                }
                transport.trace('ws error', err)
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

            transport.stream.onopen = function (evt: Event) {
                transport.trace('ws open');
                // we cannot resolve immediately! we connected to
                // a proxy which is establishing a connection to NATS,
                // that can fail - wait for data to arrive.
            };

            transport.stream.onmessage = function (me: MessageEvent) {
                // transport will resolve as soon as we get data as the
                // proxy has connected to a server
                transport.trace('>', [me.data]);
                if (connected) {
                    transport.handlers.messageHandler(me);
                } else {
                    connected = true;
                    resolve(transport);
                    setTimeout(function () {
                        transport.handlers.messageHandler(me);
                    }, 0);
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

    write(data: string): void {
        if (!this.stream || !this.isConnected()) {
            return;
        }
        this.stream.send(data);
        this.trace('<', [data]);
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
            this.stream.close();
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
            return protocol.toLowerCase() === "wss";
        }
        return false;
    }
}