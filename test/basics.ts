import test from 'ava';
import {NatsWsProxy} from './helpers/nats-wsproxy'
import {NatsConnection} from "../src/nats";

let PORT = 32000;

test.before((t) => {
    let wse = new NatsWsProxy(PORT, "localhost:4222");
    t.context = {wse: wse};
});

test.after((t) => {
    try {
        //@ts-ignore
        t.context.wse.shutdown();
    } catch(ex) {
    }
});

test('should publish', (t)=> {
    return new Promise((resolve, reject) => {
        t.plan(2);
        NatsConnection.connect({url: `ws://localhost:${PORT}`, name: 'hanger'})
            .then((c: NatsConnection) => {
                t.pass();
                c.publish('foo');
                c.flush(() => {
                    t.pass();
                    c.close();
                    resolve();
                });
            })
            .catch((err: Error) => {
                reject(err);
            });
    });
});

test('should subscribe and unsubscribe', (t)=> {
    return new Promise((resolve, reject) => {
        t.plan(12);
        NatsConnection.connect({url: `ws://localhost:${PORT}`})
            .then((c: NatsConnection) => {
                t.pass();
                c.subscribe('foo', ()=>{}, {max: 1000, queueGroup: 'aaa'})
                    .then((sub) => {
                        // sid should be registered
                        t.is(sub.sid, 1, 'has sid');
                        t.is(c.protocol.subscriptions.length, 1, 'has subscription');

                        // should be able to get the subscription description
                        // and it should have no messages
                        let s = c.protocol.subscriptions.get(1);
                        if(s) {
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
                        if(s) {
                            t.is(s.received, 0, 'no messages');
                            t.is(s.max, 10, 'max messages');
                        } else {
                            reject('expected unsubscribe to be pending');
                        }
                        sub.unsubscribe(0);
                        t.is(c.protocol.subscriptions.length, 0, 'has no subscription');
                        t.pass();
                        c.close();
                        resolve();
                    })
                    .catch((err)=> {
                        reject(err);
                    })

            })
            .catch((err: Error) => {
                reject(err);
            });
    });
});
