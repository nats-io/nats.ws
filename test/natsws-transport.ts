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
 */


import test from 'ava';
import {Transport, TransportHandlers, WSTransport} from '../src/transport';
import 'assert';
import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import {NatsConnectionOptions} from "../src/nats";


test.before((t) => {
    return new Promise((resolve, reject) => {
        startServer()
            .then((server) => {
                t.context = {server: server};
                resolve();
            })
            .catch((err) => {
                reject(err);
            });
    });
});

test.after.always((t) => {
    stopServer((t.context as SC).server);
});

test('wsnats', (t) => {
    return new Promise((resolve, reject) => {
        t.plan(2);
        let th = {} as TransportHandlers;
        th.closeHandler = () => {
        };
        th.errorHandler = (evt: Event) => {
            let err = evt as ErrorEvent;
            reject(err ? err.error : "");
        };
        th.messageHandler = (me: MessageEvent) => {
            if (me.data.match(/^INFO/)) {
                t.pass();
                transport.write("PING\r\n");
            }
            if (me.data.match(/^PONG/)) {
                t.pass();
                transport.close();
                resolve();
            }
        };
        let transport: Transport;
        let sc = t.context as SC;
        let opts = {url: sc.server.ws} as NatsConnectionOptions;
        WSTransport.connect(opts, th)
            .then(nt => {
                transport = nt;
            }).catch(err => {
            reject(err);
        })
    })
});


