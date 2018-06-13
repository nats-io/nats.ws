import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import test from "ava";
import {connect} from "../src/nats";
import {Lock} from "./helpers/latch";
import {NatsError} from "../src/error";
import * as path from 'path'

test.before(async (t) => {
    t.log(__dirname);

    let serverCert = path.join(__dirname, "../../test/helpers/certs/server-cert.pem");
    let serverKey = path.join(__dirname, "../../test/helpers/certs/server-key.pem");
    let ca = path.join(__dirname, "../../test/helpers/certs/ca.pem");

    let wsonly = await startServer("", ["--", "--tlscert", serverCert,
        "--tlskey", serverKey]);

    let wssonly = await startServer("", ["-cert", serverCert, "-key", serverKey]);

    let both = await startServer("", ["-cert", serverCert, "-key", serverKey, "--", "--tlscert", serverCert,
        "--tlskey", serverKey]);
    t.context = {server: both, wsonly: wsonly, wssonly: wssonly};

});

test.after.always((t) => {
    //@ts-ignore
    stopServer((t.context as SC).wsonly);
    stopServer((t.context as SC).server);
    //@ts-ignore
    stopServer((t.context as SC).wssonly);
});


test('wsonly', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    try {
        //@ts-ignore
        await connect({url: sc.wsonly.ws});
    } catch (ex) {
        //@ts-ignore
        let nex = ex as NatsError;
        t.is(nex.code, 'wss required');
        lock.unlock();
    }
    return lock.latch;
});

test('wssonly', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    //@ts-ignore
    await connect({url: sc.wssonly.ws});
    t.pass();
});

test.skip('tls required', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    await connect({url: sc.server.ws});
    t.pass();
});


