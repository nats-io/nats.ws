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


test('deliver to single queue', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    let subj = nuid.next();

    let subs = [];
    let count = 0;
    for (let i = 0; i < 5; i++) {
        let s = nc.subscribe(subj, () => {
            count++;
        }, {queueGroup: "a"});
        subs.push(s);
    }

    await Promise.all(subs);

    nc.publish(subj);
    await nc.flush();
    t.is(count, 1);
    nc.close();
});

test('deliver to multiple queues', async (t) => {
    t.plan(2);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    let subj = nuid.next();

    let subs = [];
    let queue1 = 0;
    for (let i = 0; i < 5; i++) {
        let s = nc.subscribe(subj, () => {
            queue1++;
        }, {queueGroup: "a"});
        subs.push(s);
    }

    let queue2 = 0;
    for (let i = 0; i < 5; i++) {
        let s = nc.subscribe(subj, () => {
            queue2++;
        }, {queueGroup: "b"});
        subs.push(s);
    }

    await Promise.all(subs);

    nc.publish(subj);
    await nc.flush();
    t.is(queue1, 1);
    t.is(queue2, 1);
    nc.close();
});

test('queues and subs independent', async (t) => {
    t.plan(2);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    let subj = nuid.next();

    let subs = [];
    let queueCount = 0;
    for (let i = 0; i < 5; i++) {
        let s = nc.subscribe(subj, () => {
            queueCount++;
        }, {queueGroup: "a"});
        subs.push(s);
    }

    let count = 0;
    subs.push(nc.subscribe(subj, () => {
        count++;
    }));

    await Promise.all(subs);

    nc.publish(subj);
    await nc.flush();
    t.is(queueCount, 1);
    t.is(count, 1);
    nc.close();
});

