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
import {connect, Msg, Payload} from "../src/nats";
import {Nuid} from "js-nuid/lib/src/nuid"
import {Lock} from "./helpers/latch";
import {SC, startServer, stopServer} from "./helpers/nats_server_control";

const nuid = new Nuid();

test.before(async (t) => {
    let server = await startServer();
    t.context = {server: server};
});

test.after.always((t) => {
    stopServer((t.context as SC).server);
});


async function macro(t: any, input: any): Promise<any> {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let subj = nuid.next();
    let nc = await connect({url: sc.server.ws, payload: Payload.BINARY});
    //
    nc.subscribe(subj, (msg: Msg) => {
        t.deepEqual(msg.data, input);
        lock.unlock();
    }, {max: 1});
    nc.publish(subj, input);
    nc.flush();
    return lock.latch;
}

var invalid2octet = new Uint8Array([0xc3, 0x28]).buffer;
var invalidsequenceidentifier = new Uint8Array([0xa0, 0xa1]).buffer;
var invalid3octet = new Uint8Array([0xe2, 0x28, 0xa1]).buffer;
var invalid4octet = new Uint8Array([0xf0, 0x90, 0x28, 0xbc]).buffer;
var embeddednull = new Uint8Array([0x00, 0xf0, 0x00, 0x28, 0x00, 0x00, 0xf0, 0x9f, 0x92, 0xa9, 0x00]).buffer;

test('invalid2octet', macro, invalid2octet);
test('invalidsequenceidentifier', macro, invalidsequenceidentifier);
test('invalid3octet', macro, invalid3octet);
test('invalid4octet', macro, invalid4octet);
test('embeddednull', macro, embeddednull);
