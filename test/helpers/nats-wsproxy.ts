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

import * as ws from 'ws'
import * as net from "net";

export class WsToSocket {
    webSocket: ws;
    tcpSocket!: net.Socket;
    debug: boolean = false;

    private constructor(websocket: ws) {
        this.webSocket = websocket;
    }

    static connect(websocket: ws, host: string, port: number, debug: boolean = false): Promise<WsToSocket> {
        return new Promise((resolve, reject) => {
            let proxy = new WsToSocket(websocket);
            proxy.debug = debug || isTracing();

            proxy.tcpSocket = net.createConnection(port, host);
            proxy.tcpSocket.on('connect', () => {
                proxy.trace('proxy ws connect');
                resolve(proxy);
            });
            proxy.tcpSocket.on('error', (err: Error) => {
                proxy.trace('proxy ws error: ', err);
                reject(err)
            });

            proxy.tcpSocket.on('close', () => {
                proxy.trace('proxy nats close');
                proxy.webSocket.close();
            });

            proxy.tcpSocket.on('data', (buf: Buffer) => {
                let v = buf.toString();
                proxy.trace('>> nats', v);
                proxy.webSocket.send(v);
                proxy.trace("<< ws", v);
            });

            proxy.webSocket.on('close', () => {
                proxy.trace('proxy ws close');
                if (proxy.tcpSocket) {
                    proxy.tcpSocket.destroy();
                }
            });

            proxy.webSocket.on('message', (s: string) => {
                proxy.trace('>> ws', s);
                if (proxy.tcpSocket) {
                    proxy.tcpSocket.write(Buffer.from(s));
                    proxy.trace('<< nats', s);
                }
            });
        });
    }

    trace(...args: any[]) {
        if (this.debug) {
            console.log(args);
        }
    }
}

function isTracing(): boolean {
    let v = process.env.TRACE;
    return v != undefined;
}

export class NatsWsProxy {
    server: ws.Server;
    webSockets: WsToSocket[] = [];
    debug: boolean;

    constructor(port: number, natsHostPort: string = "localhost:4222", debug: boolean = false) {
        this.debug = debug || isTracing();

        let opts = {} as ws.ServerOptions;
        opts.port = port;
        this.server = new ws.Server(opts);

        let hp = natsHostPort.split(':') as any[];
        hp[1] = parseInt(hp[1], 10);

        this.server.on('connection', (websocket: ws) => {
            this.trace('proxy: websocket connected');

            websocket.on('close', (ws: ws) => {
                this.trace('proxy ws close')
                let wse = this.webSockets.find((e) => {
                    return e.webSocket === ws;
                });
                if (wse) {
                    this.webSockets.splice(this.webSockets.indexOf(wse), 1);
                }
            });
            WsToSocket.connect(websocket, hp[0], hp[1])
                .then((proxy) => {
                    this.webSockets.push(proxy);
                })
                .catch((err) => {
                    console.error('error connecting to nats: ', err);
                });
        });

    }

    trace(...args: any[]): void {
        if (this.debug) {
            console.log(args.join(' '));
        }
    }

    shutdown(): void {
        this.server.close();
    }
}