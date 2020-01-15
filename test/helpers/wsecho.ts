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

export class WSEchoServer {
    server: ws.Server;

    constructor(port: number) {
        let opts = {} as ws.ServerOptions;
        opts.port = port;
        this.server = new ws.Server(opts);

        this.server.on('connection', (client: ws) => {
            client.on('message', (data) => {
                this.server.clients.forEach((c) => {
                    c.send(data, (err) => {
                        if (err) {
                            console.error('Error sending %s', err);
                        }
                    });
                });
            });
        });

        this.server.on('error', (err: Error) => {
            console.error(err);
        });
    }

    shutdown(): void {
        this.server.close();
    }
}