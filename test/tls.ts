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

import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import test from "ava";
import {connect} from "../src/nats";
import {Lock} from "./helpers/latch";
import {ErrorCode, NatsError} from "../src/error";
import * as path from 'path'

test.before(async (t) => {
    let serverCert = path.join(__dirname, "../../test/helpers/certs/server.pem");
    let serverKey = path.join(__dirname, "../../test/helpers/certs/key.pem");
    let ca = path.join(__dirname, "../../test/helpers/certs/ca.pem");

    let server = await startServer({tls: {cert_file: serverCert, key_file: serverKey, ca_file: ca}});
    t.context = {server: server};

});

test.after.always((t) => {
    //@ts-ignore
    stopServer((t.context as SC).server);
});


test('wsonly', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    try {
        //@ts-ignore
        await connect({url: sc.server.ws});
    } catch (ex) {
        //@ts-ignore
        let nex = ex as NatsError;
        t.is(nex.code, ErrorCode.WSS_REQUIRED);
        lock.unlock();
    }
    return lock.latch;
});



