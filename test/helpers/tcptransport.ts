/*
 * Copyright 2018 The NATS Authors
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
 *
 */


import * as net from "net";
import * as tls from "tls";
import {ConnectionOptions, TLSSocket} from "tls";
import {Transport, TransportHandlers} from "../../src/transport";

export class TCPTransport implements Transport {
    stream: net.Socket | null = null;
    handlers: TransportHandlers;
    closed: boolean = false;

    private constructor(handlers: TransportHandlers) {
        this.handlers = handlers;
    }

    static connect(url: URL, handlers: TransportHandlers) : Promise<Transport> {
        let transport = new TCPTransport(handlers);
        return new Promise((resolve, reject) => {
            transport.stream = net.createConnection(parseInt(url.port,10), url.hostname);

            let rejector = function(err: Error) {
                if(transport.stream) {
                    transport.stream.removeAllListeners();
                }
                reject(err);
            };
            let resolver = function() {
                if(transport.stream) {
                    transport.stream.removeListener('connect', resolver);
                    transport.stream.removeListener('error', rejector);
                }
                transport.setupHandlers();
                resolve();
            };

            transport.stream.on('connect', resolver);
            transport.stream.on('error', rejector);
        });
    }

    private setupHandlers() : void {
        if(! this.stream) {
            return;
        }
        this.stream.on('close', this.handlers.closeHandler);
        this.stream.on('error', this.handlers.errorHandler);
        this.stream.on('data', this.handlers.messageHandler);
    }


    isClosed() : boolean {
        return this.closed;
    }

    isConnected() : boolean {
        return this.stream != null && !this.stream.connecting;
    }

    isEncrypted(): boolean {
        return this.stream instanceof TLSSocket && this.stream.encrypted;
    }

    isAuthorized() : boolean {
        return this.stream instanceof TLSSocket && this.stream.authorized;
    }

    upgrade(tlsOptions: any, done: Function) : void {
        if(! this.stream) {
            return
        }

        let opts: ConnectionOptions;
        if('object' === typeof tlsOptions) {
            opts = tlsOptions as ConnectionOptions;
        } else {
            opts = {} as ConnectionOptions;
        }
        opts.socket = this.stream;
        this.stream.removeAllListeners();
        this.stream = tls.connect(opts, () => {
            done();
        });
        this.setupHandlers();
    }

    write(data: Buffer|string): void {
        if(! this.stream) {
            return;
        }
        this.stream.write(data);
    }

    destroy() : void {
        if(! this.stream) {
            return;
        }
        if(this.closed) {
            this.stream.removeAllListeners();
        }
        this.stream.destroy();
        this.stream = null;
    }

    close() : void {
        this.closed = true;
        this.destroy();
    }

    pause() : void {
        if(! this.stream) {
            return;
        }
        this.stream.pause()
    }

    resume() : void {
        if(! this.stream) {
            return;
        }
        this.stream.resume();
    }
}