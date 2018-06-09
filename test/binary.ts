import test from "ava";
import {connect} from "../src/nats";
import {Nuid} from 'js-nuid/src/nuid'
import {Msg} from "../src/protocol";
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
    let nc = await connect({url: sc.server.ws});
    //
    nc.subscribe(subj, (msg: Msg) => {
        t.pass();
        //     // in JSON undefined is translated to null
        //     if (input === undefined) {
        //         input = null;
        //     }
        //     t.deepEqual(msg.data, input);
        //     // t.log([input, '===', msg.data]);
        lock.unlock();
    }, {max: 1});
    //
    // t.log(input);
    nc.publish(subj, input);
    nc.flush();
    return lock.latch;
}

var invalid2octet = new Uint8Array([0xc3, 0x28]);
var invalidsequenceidentifier = new Uint8Array([0xa0, 0xa1]);
var invalid3octet = new Uint8Array([0xe2, 0x28, 0xa1]);
var invalid4octet = new Uint8Array([0xf0, 0x90, 0x28, 0xbc]);
var embeddednull = new Uint8Array([0x00, 0xf0, 0x00, 0x28, 0x00, 0x00, 0xf0, 0x9f, 0x92, 0xa9, 0x00]);

test('invalid2octet', macro, invalid2octet);
// test('invalidsequenceidentifier', macro, invalidsequenceidentifier);
// test('invalid3octet', macro, invalid3octet);
// test('invalid4octet', macro, invalid4octet);
// test('embeddednull', macro, embeddednull);
