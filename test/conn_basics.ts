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
import {NatsWsProxy} from './helpers/nats-wsproxy'
import {NatsConnection} from "../src/nats";
import {Msg} from "../src/protocol";

test.before((t) => {
    let wse = new NatsWsProxy(30000, "localhost:4222");
    t.context = {wse: wse};
});

test.after((t) => {
    try {
        //@ts-ignore
        t.context.wse.shutdown();
    } catch(ex) {
    }
});

test('client connect fails on bad port', (t)=> {
    return new Promise((resolve, reject) => {
        t.plan(1);
        NatsConnection.connect({url: "ws://localhost:30001"})
            .then((c: NatsConnection) => {
                c.close();
                reject('should have not been able to connect');
            })
            .catch((err: Error) => {
                t.pass();
                resolve();
            });
    });
});

test('client connect', (t)=> {
    return new Promise((resolve, reject) => {
        t.plan(1);
        NatsConnection.connect({url: "ws://localhost:30000"})
            .then((c: NatsConnection) => {
                t.pass();
                c.close();
                resolve();
            })
            .catch((err: Error) => {
                reject(err);
            });
    });

});

test('bad publish', (t)=> {
    return new Promise((resolve, reject) => {
        t.plan(2);
        NatsConnection.connect({url: "ws://localhost:30000"})
            .then((c: NatsConnection) => {
                t.pass();
                c.addEventListener('error', (err)=>{
                    t.pass();
                    c.close();
                    resolve();
                });
                c.publish("", "");
            })
            .catch((err: Error) => {
                reject(err);
            });
    });
});

test('hello', (t)=> {
    t.plan(4);
    return new Promise((resolve, reject) => {
        NatsConnection.connect({url: "ws://localhost:30000"})
            .then((c: NatsConnection) => {
                t.pass();
                c.addEventListener('error', (err)=>{
                    reject();
                });
                c.subscribe("hello", (msg: Msg) => {
                    t.pass();
                    if(msg.data === "world") {
                        t.pass();
                    }
                    c.close();
                    resolve();
                }).then((sub) => {
                    c.publish("hello", "world");
                    t.pass();
                    c.flush();
                });
            })
            .catch((err: Error) => {
                reject(err);
            });
    });

});