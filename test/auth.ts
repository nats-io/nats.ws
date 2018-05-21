import {NatsConnection} from "../src/nats";
import {NatsWsProxy} from "./helpers/nats-wsproxy";
import test from "ava";
import {startServer, stopServer} from "./helpers/nats_server_control";

let WSPORT = 45567;
let PORT = 45398;

test.before((t) => {
    return new Promise((resolve, reject) => {
        let flags = ['--user', 'derek', '--pass', 'foobar'];
        startServer(PORT, flags)
            .then((server) => {
                t.log('server started');
                let wse = new NatsWsProxy(WSPORT, `localhost:${PORT}`);
                t.context = {wse: wse, server: server};
                resolve();
            });
    });
});

test.after.always((t) => {
    //@ts-ignore
    t.context.wse.shutdown();
    //@ts-ignore
    stopServer(t.context.server);
});


test('no auth', async (t) => {
    t.plan(2);
    try {
        let nc = await NatsConnection.connect({url: `ws://localhost:${WSPORT}`});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

// test('auth', async (t) => {
//     t.plan(2);
//     try {
//         let nc = await NatsConnection.connect({url: `ws://localhost:${WSPORT}`, user: 'derek', pass: 'foobar'});
//     } catch (err) {
//         t.truthy(err);
//         t.regex(err.message, /Authorization/);
//     }
// });