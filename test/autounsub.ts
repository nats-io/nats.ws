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

import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import test from "ava";
import {connect} from "../src/nats";
import {Nuid} from 'js-nuid/src/nuid'

const nuid = new Nuid();

test.before(async (t) => {
    let server = await startServer();
    t.context = {server: server};
});

test.after.always((t) => {
    stopServer((t.context as SC).server);
});

test('auto unsub from max from options', async (t) => {
    t.plan(1);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});

        let count = 0;
        let subj = nuid.next();
        let sub = await nc.subscribe(subj, () => {
            count++;
        }, {max: 10});
        for (let i = 0; i < 20; i++) {
            nc.publish(subj);
        }

        await nc.flush();
        t.is(count, 10);
        nc.close()
    } catch (err) {
        t.fail("got exception " + err);
    }
});


test('auto unsub from unsubscribe', async (t) => {
    t.plan(1);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});

        let count = 0;
        let subj = nuid.next();
        let sub = await nc.subscribe(subj, () => {
            count++;
        }, {max: 10});
        sub.unsubscribe(11);
        for (let i = 0; i < 20; i++) {
            nc.publish(subj);
        }

        await nc.flush();
        t.is(count, 11);
        nc.close()
    } catch (err) {
        t.fail("got exception" + err);
    }
});

test('can unsub from auto-unsubscribed', async (t) => {
    t.plan(1);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});

        let count = 0;
        let subj = nuid.next();
        let sub = await nc.subscribe(subj, () => {
            count++;
        }, {max: 1});
        for (let i = 0; i < 20; i++) {
            nc.publish(subj);
        }
        await nc.flush();
        t.is(count, 1);
        sub.unsubscribe();
        nc.close()
    } catch (err) {
        t.fail("got exception" + err);
    }
});

test('can change auto-unsub to a lesser value', async (t) => {
    t.plan(1);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});

        let count = 0;
        let subj = nuid.next();
        let sub = await nc.subscribe(subj, () => {
            count++;
            sub.unsubscribe(1);
        });
        sub.unsubscribe(20);
        for (let i = 0; i < 20; i++) {
            nc.publish(subj);
        }
        await nc.flush();
        t.is(count, 1);
        nc.close()
    } catch (err) {
        t.fail("got exception" + err);
    }
});

test('can change auto-unsub to a higher value', async (t) => {
    t.plan(1);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});

        let count = 0;
        let subj = nuid.next();
        let sub = await nc.subscribe(subj, () => {
            count++;
        });
        sub.unsubscribe(1);
        sub.unsubscribe(10);
        for (let i = 0; i < 20; i++) {
            nc.publish(subj);
        }
        await nc.flush();
        t.is(count, 10);
        nc.close()
    } catch (err) {
        t.fail("got exception" + err);
    }
});

test('request receives expected count with multiple helpers', async (t) => {
    t.plan(2);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});
        let subj = nuid.next();

        let answers = 0;
        let promises = [];
        for (let i = 0; i < 5; i++) {
            let p = nc.subscribe(subj, (msg) => {
                if (msg.reply) {
                    nc.publish(msg.reply);
                    answers++;
                }
            });
            promises.push(p);
        }

        await Promise.all(promises);

        //
        let answer = await nc.request(subj);
        await nc.flush();
        t.is(answers, 5);
        t.truthy(answer);

        nc.close()
    } catch (err) {
        t.fail("got exception" + err);
    }
});

test('manual request receives expected count with multiple helpers', async (t) => {
    t.plan(6);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});
        let requestSubject = nuid.next();

        // create some promises that we resolve when our responders answer
        let resolvers = [] as Function[];
        let answers = [] as Promise<any>[];
        for (let i = 0; i < 5; i++) {
            answers.push(new Promise((resolve) => {
                resolvers[i] = resolve;
            }));
        }

        let subs = [];
        for (let i = 0; i < 5; i++) {
            // closure the promise so we can uniquely resolve
            (function (id: number) {
                let p = nc.subscribe(requestSubject, (msg) => {
                    if (msg.reply) {
                        nc.publish(msg.reply);
                        resolvers[id]();
                        t.pass();
                    }
                });
                subs.push(p);
            }(i));
        }

        let replySubj = nuid.next();
        let count = 0;
        let s = await nc.subscribe(replySubj, () => {
            count++;
        }, {max: 1});
        subs.push(s);

        // wait for all subscriptions
        await Promise.all(subs);

        // publish the request
        await nc.publish(requestSubject, "", replySubj).flush();
        // wait for all responders to resolve
        await Promise.all(answers);
        // finally wait for the pong - by then request response is received
        await nc.flush();
        t.is(count, 1);
        nc.close()
    } catch (err) {
        t.fail("got exception" + err);
    }
});

test('check subscription leaks', async (t) => {
    t.plan(1);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});
        let subj = nuid.next();
        let sub = await nc.subscribe(subj, () => {
        });
        sub.unsubscribe();
        t.is(nc.protocol.subscriptions.length, 0);
        nc.close()
    } catch (err) {
        t.fail("got exception" + err);
    }
});

test('check request leaks', async (t) => {
    t.plan(6);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});
        let subj = nuid.next();

        // should have no subscriptions
        t.is(nc.protocol.subscriptions.length, 0);

        let sub = await nc.subscribe(subj, (msg) => {
            if (msg.reply) {
                nc.publish(msg.reply);
            }
        });

        // should have one subscription
        t.is(nc.protocol.subscriptions.length, 1);

        let msgs = [];
        msgs.push(nc.request(subj));
        msgs.push(nc.request(subj));

        // should have 2 mux subscriptions, and 2 subscriptions
        t.is(nc.protocol.subscriptions.length, 2);
        t.is(nc.protocol.muxSubscriptions.length, 2);

        await Promise.all(msgs);

        // mux subs should have pruned
        t.is(nc.protocol.muxSubscriptions.length, 0);


        sub.unsubscribe();
        t.is(nc.protocol.subscriptions.length, 1);
        nc.close()
    } catch (err) {
        t.fail("got exception" + err);
    }
});

test('check cancelled request leaks', async (t) => {
    t.plan(6);
    try {
        let sc = t.context as SC;
        let nc = await connect({url: sc.server.ws});
        let subj = nuid.next();

        // should have no subscriptions
        t.is(nc.protocol.subscriptions.length, 0);

        let rp = nc.request(subj);

        // should have 2 mux subscriptions, and 2 subscriptions
        t.is(nc.protocol.subscriptions.length, 1);
        t.is(nc.protocol.muxSubscriptions.length, 1);

        // the rejection should be timeout
        rp.catch((rej) => {
            t.is(rej, 'timeout');
        });

        // wait for it
        try {
            await rp;
        } catch (err) {
            t.pass();
        }

        // mux subs should have pruned
        t.is(nc.protocol.muxSubscriptions.length, 0);

        nc.close()
    } catch (err) {
        t.fail("got exception" + err);
    }
});