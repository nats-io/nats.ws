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

import test from "ava";
import {ClientHandlers, ProtocolHandler, Sub} from "../src/protocol";
import {NatsConnectionOptions} from "../src/nats";

test('split messages correctly', (t) => {
    return new Promise((resolve) => {
        t.plan(4);
        let expected = 3;
        let processed = 0;

        let protocol = new ProtocolHandler({} as NatsConnectionOptions, {} as ClientHandlers);
        protocol.infoReceived = true;
        let data = 'MSG test.foo 1 11\r\nHello World\r\nMSG test.bar 1 11\r\nHello World\r\nMSG test.baz 1 11\r\nHello World\r\nPONG\r\n';
        protocol.inbound.fill(new TextEncoder().encode(data).buffer);

        let s = {} as Sub;
        s.sid = 1;
        s.subject = "test.*";
        s.callback = (msg => {
            processed++;
            //@ts-ignore
            t.is(msg.data, "Hello World");
            if (processed === expected) {
                t.pass();
                resolve();
            }
        });

        protocol.subscriptions.add(s);
        protocol.processInbound();
    });
});
