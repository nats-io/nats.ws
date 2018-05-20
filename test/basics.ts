import {NatsWsProxy} from './helpers/nats-wsproxy'
import {NatsConnection} from "../src/nats";
import test from "ava";
import nuid from 'nuid';
import {Msg} from "../src/protocol";

let PORT = 32000;

test.before((t) => {
    let wse = new NatsWsProxy(PORT, "localhost:4222");
    t.context = {wse: wse};
});

test.after((t) => {
    try {
        //@ts-ignore
        t.context.wse.shutdown();
    } catch (ex) {
        console.error(ex);
    }
});


test('connect', (t) => {
    return NatsConnection.connect({url: `ws://localhost:${PORT}`})
        .then(nc => {
            nc.close();
            t.pass();
        });
});

test('shouldnt connect', (t) => {
    return NatsConnection.connect({url: `ws://localhost:32001`})
        .then(c => {
            c.close();
            t.fail();
        })
        .catch(nc => {
            t.pass();
        });
});

test('publish', (t) => {
    t.plan(1);
    return new Promise((resolve, reject) => {
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                c.publish('foo');
                c.flush(() => {
                    t.pass();
                    c.close();
                    resolve();
                });
            });
    });
});

test('subscribe and unsubscribe', (t) => {
    return new Promise((resolve, reject) => {
        try {
            t.plan(10);
            NatsConnection.connect({url: `ws://localhost:${PORT}`})
                .then((c: NatsConnection) => {
                    c.subscribe('foo', () => {
                    }, {max: 1000, queueGroup: 'aaa'})
                        .then((sub) => {
                            // sid should be registered
                            t.is(sub.sid, 1, 'has sid');
                            t.is(c.protocol.subscriptions.length, 1, 'has subscription');

                            // should be able to get the subscription description
                            // and it should have no messages
                            let s = c.protocol.subscriptions.get(1);
                            if (s) {
                                t.is(s.received, 0, 'no messages');
                                t.is(s.subject, 'foo', 'correct subject');
                                t.truthy(s.callback, 'callback exists');
                                t.is(s.max, 1000, 'default max exists');
                                t.is(s.queueGroup, 'aaa', 'queue name is set');
                            } else {
                                reject('expected to get subscription');
                            }

                            // change it to auto-unsub after 10
                            sub.unsubscribe(10);
                            s = c.protocol.subscriptions.get(1);
                            if (s) {
                                t.is(s.received, 0, 'no messages');
                                t.is(s.max, 10, 'max messages');
                            } else {
                                reject('expected unsubscribe to be pending');
                            }
                            sub.unsubscribe(0);
                            t.is(c.protocol.subscriptions.length, 0, 'has no subscription');
                            c.close();
                            resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        })
                })
                .catch((err: Error) => {
                    reject(err);
                });
        }
        catch (err) {
            console.log(err);
        }
    });
});

test('subscriptions fire callbacks', (t) => {
    return new Promise((resolve, reject) => {
        t.plan(2);
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                let s = nuid.next();
                c.subscribe(s, () => {
                    t.pass();
                    c.close();
                    resolve();
                }, {max: 1}).then((sub) => {
                    t.truthy(sub.sid);
                });
                c.publish(s);
            });
    });
});

test('subscriptions returns Subscription', (t) => {
    return new Promise((resolve, reject) => {
        t.plan(3);
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                let s = nuid.next();
                c.subscribe(s, () => {}).then((sub) => {
                    t.true(sub.sid > 0);
                    t.is(1, c.protocol.subscriptions.length);
                    sub.unsubscribe();
                    t.is(0, c.protocol.subscriptions.length);
                    c.close();
                    resolve();
                });
                c.publish(s);
            });
    });
});

test('wildcard subscriptions', (t) => {
   return new Promise((resolve, reject) => {
       t.plan(1);
       let expected = 3;
       let received = 0;
       NatsConnection.connect({url: `ws://localhost:${PORT}`})
           .then((c: NatsConnection) => {
               let s = nuid.next();
               c.subscribe(`${s}.*`, (msg: Msg) => {
                   received++;
               }).then((sub) => {
                   c.publish(`${s}.foo.baz`);     // miss
                   c.publish(`${s}.foo.baz.foo`); // miss
                   c.publish(`${s}.foo.baz.3`); // miss
                   c.publish(`${s}.foo`);
                   c.publish(`${s}.bar`);
                   c.publish(`${s}.baz`);
                   c.flush(() => {
                      t.is(received, expected);
                      sub.unsubscribe();
                      c.close();
                      resolve()
                   });
               });
           });
    });
});

test('request fire callbacks', (t) => {
    return new Promise((resolve, reject) => {
        t.plan(5);
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                let s = 'hello';
                c.subscribe(s, (msg: Msg) => {
                    t.is(msg.subject, s);
                    t.is(msg.data, 'hi');
                    if (msg.reply) {
                        t.regex(msg.reply,/^_INBOX\.*/);
                        c.publish(msg.reply, 'foo');
                    }
                });
                c.request(s, (msg: Msg) => {
                    t.is(msg.data, 'foo');
                    t.is(c.protocol.muxSubscriptions.length, 0);
                    c.close();
                    resolve();
                }, "hi");
            });
    });
});

test('request return a Request', (t) => {
    return new Promise((resolve, reject) => {
        t.plan(3);
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                c.request(nuid.next(), (msg: Msg) => {})
                    .then((req) => {
                        t.true(req.token.length > 0);
                        t.is(1, c.protocol.muxSubscriptions.length);
                        req.unsubscribe();
                        t.is(0, c.protocol.muxSubscriptions.length);
                        c.close();
                        resolve();
                    });
            });
    });
});

test('correct data in message', (t) => {
    return new Promise((resolve, reject) => {
        t.plan(3);
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                let s = nuid.next();
                let sub = c.subscribe(s, (m) => {
                    t.is(m.subject, s);
                    t.is(m.data, '0xFEEDFACE');
                    t.is(m.reply, undefined);
                    c.close();
                    resolve();
                }, {max: 1});
                c.publish(s, '0xFEEDFACE');
            });
    });
});

test('correct reply in message', (t) => {
    return new Promise((resolve, reject) => {
        t.plan(2);
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                let s = nuid.next();
                let r = nuid.next();
                c.subscribe(s, (m) => {
                    t.is(m.subject, s);
                    t.is(m.reply, r);
                    c.close();
                    resolve();
                }, {max: 1});
                c.publish(s, null, r);
            });
    });
});

test('closed cannot subscribe', (t) => {
    return new Promise((resolve, reject) => {
        t.plan(1);
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                c.close();
                c.subscribe('foo', () => {
                })
                    .catch((err) => {
                        t.pass();
                        resolve();
                    })
            })
    });
});

test('close cannot request', (t) => {
    return new Promise((resolve, reject) => {
        t.plan(1);
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                c.close();
                c.request('foo', () => {
                })
                    .catch((err) => {
                        t.pass();
                        resolve();
                    })
            })
    });
});