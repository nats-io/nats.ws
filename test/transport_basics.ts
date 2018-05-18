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


import test from 'ava';
import {WSEchoServer} from './helpers/wsecho'
import {Transport, TransportHandlers, WSTransport} from '../src/transport';
import 'assert';

test.before((t) => {
    let wse = new WSEchoServer(50000);
    t.context = {wse: wse};
});

test.after((t) => {
    try {
        //@ts-ignore
        t.context.wse.shutdown();
    } catch(ex) {
    }
});

test.cb('ws should emit connect', (t)=> {
    t.plan(2);

    let th = {} as TransportHandlers;

    th.closeHandler = () => {};
    th.errorHandler = (evt: Event) => {
        console.log(evt);
    };
    th.messageHandler = (data: MessageEvent) => {
        if(data.data == "hello") {
            t.pass();
            transport.close();
            t.end();
        }
    };

    let transport : Transport;
    WSTransport.connect(new URL("ws://localhost:50000"), th)
        .then((nt) => {
            t.pass();
            transport = nt;
            transport.write("hello");
        })
        .catch((err) => {
            t.fail(err);
            t.end();
        });
});

test.cb('ws should not emit connect', (t)=> {
    t.plan(1);

    let th = {} as TransportHandlers;

    th.closeHandler = () => {};
    th.errorHandler = (evt: Event) => {
        console.log(evt);
    };
    th.messageHandler = (data: MessageEvent) => {};

    WSTransport.connect(new URL("ws://localhost:50001"), th)
        .then((nt) => {
            t.fail('connect was not expected have connected');
            nt.close();
            t.end();
        })
        .catch((err) => {
            t.pass(err);
            t.end();
        });
});



