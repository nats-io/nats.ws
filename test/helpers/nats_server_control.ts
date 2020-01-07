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
 *
 */

import {ChildProcess, spawn} from 'child_process';
import * as net from 'net';
import {Socket} from 'net';
import path from 'path'
import fs from 'fs'
import Timer = NodeJS.Timer;

let SERVER = (process.env.TRAVIS) ? 'wsgnatsd/wsgnatsd' : 'wsgnatsd';
let PID_DIR = (process.env.TRAVIS) ? process.env.TRAVIS_BUILD_DIR : process.env.TMPDIR;

// context for tests
export interface SC {
    server: Server
}

export interface Server extends ChildProcess {
    args: string[];
    ws: string;
    nats: string;
}

export function natsURL(s: Server): string {
    return s.nats;
}

export function wsURL(s: Server): string {
    return s.nats;
}

export function getPort(urlString: string): number {
    let u = new URL(urlString);
    return parseInt(u.port, 10);
}

export function startServer(hostport?: string, opt_flags?: string[]): Promise<Server> {
    return new Promise((resolve, reject) => {

        let flags = ['-pid', PID_DIR] as string[];
        if (hostport) {
            flags.concat(['-hp', hostport]);
        }

        if (opt_flags) {
            flags = flags.concat(opt_flags);
        }

        let port = -1;

        if (process.env.PRINT_LAUNCH_CMD) {
            console.log(flags.join(" "));
        }

        let server = spawn(SERVER, flags) as Server;
        server.args = flags;

        let start = Date.now();
        let wait: number = 0;
        let maxWait = 5 * 1000; // 5 secs
        let delta = 250;
        let socket: Socket | null;
        let timer: Timer | null;

        //@ts-ignore
        // server.stderr.on('data', function (data) {
        //     let lines = data.toString().split('\n');
        //     lines.forEach((m: string) => {
        //         console.log(m);
        //     });
        // });

        function resetSocket() {
            if (socket) {
                socket.removeAllListeners();
                socket.destroy();
                socket = null;
            }
        }

        function finish(err?: Error) {
            resetSocket();
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            if (err === undefined) {
                // return where the ws is running
                resolve(server);
                return;
            }
            reject(err);
        }

        let count = 50;
        new Promise<any>((r, x) => {
            let t = setInterval(() => {
                --count;
                if (count === 0) {
                    clearInterval(t);
                    x('Unable to find the pid');
                }
                //@ts-ignore
                let pidFile = path.join(PID_DIR, `wsgnatsd_${server.pid}.pid`);
                if (fs.existsSync(pidFile)) {
                    fs.readFileSync(pidFile).toString().split("\n").forEach((s) => {
                        if (s.startsWith('ws://') || s.startsWith('wss://')) {
                            (server as Server).ws = s;
                        } else {
                            (server as Server).nats = s;
                        }
                    });

                    port = getPort(server.nats);
                    clearInterval(t);
                    r();
                }

            }, 150);
        }).then(() => {
            // Test for when socket is bound.
            timer = <any>setInterval(function () {
                resetSocket();

                wait = Date.now() - start;
                if (wait > maxWait) {
                    finish(new Error('Can\'t connect to server on port: ' + port));
                }

                // Try to connect to the correct port.
                socket = net.createConnection(port);

                // Success
                socket.on('connect', function () {
                    if (server.pid === null) {
                        // We connected but not to our server..
                        finish(new Error('Server already running on port: ' + port));
                    } else {
                        finish();
                    }
                });

                // Wait for next try..
                socket.on('error', function (error) {
                    finish(new Error("Problem connecting to server on port: " + port + " (" + error + ")"));
                });

            }, delta);
        })
            .catch((err) => {
                reject(err);
            });


        // Other way to catch another server running.
        server.on('exit', function (code, signal) {
            if (code === 1) {
                finish(new Error('Server exited with bad code, already running? (' + code + ' / ' + signal + ')'));
            }
        });

        // Server does not exist..
        // @ts-ignore
        server.stderr.on('data', function (data) {
            if (/^execvp\(\)/.test(data.toString())) {
                if (timer) {
                    clearInterval(timer);
                }
                finish(new Error('Can\'t find the ' + SERVER));
            }
        });
    });

}

function wait(server: Server, done?: Function): void {
    if (server.killed) {
        if (done) {
            done();
        }
    } else {
        setTimeout(function () {
            wait(server, done);
        }, 0);
    }
}

export function stopServer(server: Server | null, done?: Function): void {
    if (server && !server.killed) {
        server.kill();
        wait(server, done);
    } else if (done) {
        done();
    }
}
