/*
 * Copyright 2020 The NATS Authors
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
const path = require("path");
const { check } = require("./delay");
const {
  deferred,
  delay,
  timeout,
  nuid,
} = require("../../build/nats-base-client/internal_mod");

const { spawn } = require("child_process");

const fs = require("fs");
const os = require("os");
const net = require("net");

const ServerSignals = new Map();
ServerSignals.set("KILL", "SIGKILL");
ServerSignals.set("QUIT", "SIGQUIT");
ServerSignals.set("STOP", "SIGSTOP");
ServerSignals.set("REOPEN", "SIGUSR1");
ServerSignals.set("RELOAD", "SIGHUP");
ServerSignals.set("LDM", "SIGUSR2");

exports.tlsConfig = () => {
  const dir = process.cwd();
  return {
    cert_file: path.resolve(path.join(dir, "./test/certs/localhost.crt")),
    key_file: path.resolve(path.join(dir, "./test/certs/localhost.key")),
    ca_file: path.resolve(path.join(dir, "./test/certs/ca.crt")),
  };
};

exports.wsConfig = () => {
  return {
    websocket: {
      no_tls: true,
      port: -1,
    },
  };
};

function parseHostport(s) {
  if (!s) {
    return;
  }
  const idx = s.indexOf("://");
  if (idx) {
    s = s.slice(idx + 3);
  }
  const [hostname, ps] = s.split(":");
  const port = parseInt(ps, 10);

  return { hostname, port };
}

function parsePorts(ports) {
  ports.monitoring = ports.monitoring || [];
  ports.cluster = ports.cluster || [];
  ports.websocket = ports.websocket || [];
  const listen = parseHostport(ports.nats[0]);
  const p = {};

  if (listen) {
    p.hostname = listen.hostname;
    p.port = listen.port;
  }

  const cluster = ports.cluster.map((v) => {
    if (v) {
      return parseHostport(v)?.port;
    }
    return undefined;
  });
  p.cluster = cluster[0];

  const monitoring = ports.monitoring.map((v) => {
    if (v) {
      return parseHostport(v)?.port;
    }
    return undefined;
  });
  p.monitoring = monitoring[0];

  const websocket = ports.websocket.map((v) => {
    if (v) {
      return parseHostport(v)?.port;
    }
    return undefined;
  });
  p.websocket = websocket[0];

  return p;
}

exports.NatsServer = class NatsServer {
  hostname;
  clusterName;
  port;
  cluster;
  monitoring;
  websocket;
  process;
  logBuffer = [];
  stopped = false;
  done;
  debug;
  config;

  constructor(opts = {
    info: {
      hostname: "",
      port: 0,
      cluster: 0,
      monitoring: 0,
      websocket: 0,
      clusterName: "",
    },
    process: undefined,
    debug: false,
    config: {},
  }) {
    const { info, process, debug, config } = opts;
    this.hostname = info.hostname;
    this.port = info.port;
    this.cluster = info.cluster;
    this.monitoring = info.monitoring;
    this.websocket = info.websocket;
    this.clusterName = info.clusterName;
    this.process = process;
    this.done = deferred();
    this.config = config;

    this.process.stderr.on("data", (data) => {
      data = data.toString();
      this.logBuffer.push(data);
      if (debug) {
        debug.log(data);
      }
    });

    this.process.on("exit", () => {
      this.done.resolve();
    });
  }

  restart() {
    const conf = JSON.parse(JSON.stringify(this.config));
    conf.port = this.port;
    if (this.websocket) {
      conf.websocket.port = this.websocket;
    }
    return NatsServer.start(conf, this.debug);
  }

  getLog() {
    return this.logBuffer.join("");
  }

  static stopAll(cluster) {
    const buf = [];
    cluster.forEach((s) => {
      buf.push(s.stop());
    });

    return Promise.all(buf);
  }

  async stop() {
    if (!this.stopped) {
      this.stopped = true;
      await this.signal("SIGTERM");
    }
    await this.done;
  }

  signal(signal) {
    const sn = ServerSignals.get(signal);
    this.process.kill(sn ? sn : signal);
  }

  async varz() {
    if (!this.monitoring) {
      return Promise.reject(new Error("server is not monitoring"));
    }
    const resp = await fetch(`http://127.0.0.1:${this.monitoring}/varz`);
    return await resp.json();
  }

  static async cluster(
    count = 2,
    conf = {},
    debug = false,
  ) {
    conf = conf || {};
    conf = Object.assign({}, conf);
    conf.cluster = conf.cluster || {};
    conf.cluster.name = nuid.next();
    conf.cluster.listen = conf.cluster.listen || "127.0.0.1:-1";

    const ns = await NatsServer.start(conf, debug);
    const cluster = [ns];

    for (let i = 1; i < count; i++) {
      const s = await NatsServer.addClusterMember(ns, conf, debug);
      cluster.push(s);
    }

    return cluster;
  }

  static async start(conf = {}, debug = undefined) {
    const exe = process.env.CI
      ? "/home/runner/work/nats.ws/nats.ws/nats-server"
      : "nats-server";
    const tmp = path.resolve(process.env.TMPDIR || ".");

    let srv;
    return new Promise(async (resolve, reject) => {
      try {
        conf = conf || {};
        conf.ports_file_dir = tmp;
        conf.host = conf.host || "127.0.0.1";
        conf.port = conf.port || -1;
        conf.http = conf.http || "127.0.0.1:-1";

        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nats-"));
        const confFile = path.join(dir, "server.conf");
        fs.writeFileSync(confFile, toConf(conf));
        if (debug) {
          debug.log(`${exe} -c ${confFile}`);
        }
        srv = await spawn(exe, ["-c", confFile]);

        if (debug) {
          debug.log(`[${srv.pid}] - launched`);
        }

        const portsFile = path.resolve(
          path.join(tmp, `nats-server_${srv.pid}.ports`),
        );

        const pi = await check(
          () => {
            try {
              const data = fs.readFileSync(portsFile);
              const txt = new TextDecoder().decode(data);
              const d = JSON.parse(txt);
              if (d) {
                return d;
              }
            } catch (_) {
            }
          },
          1000,
          { name: "read ports file" },
        );

        if (debug) {
          debug.log(`[${srv.pid}] - ports file found`);
        }

        const ports = parsePorts(pi);
        if (conf.cluster?.name) {
          ports.clusterName = conf.cluster.name;
        }
        await check(
          async () => {
            const d = deferred();
            try {
              if (debug) {
                debug.log(`[${srv.pid}] - attempting to connect`);
              }
              const tc = net.createConnection(ports.port, ports.hostname);
              tc.on("connect", () => {
                tc.destroy();
                d.resolve(ports.port);
              });
            } catch (err) {
              return d.reject(err);
            }
            return d;
          },
          5000,
          { name: "wait for server" },
        );
        resolve(
          new NatsServer(
            { info: ports, process: srv, debug: debug, config: conf },
          ),
        );
      } catch (err) {
        if (srv) {
          try {
            debug.log(srv.stderrOutput);
          } catch (err) {
            debug.log("unable to read server output:", err);
          }
        }
        reject(err);
      }
    });
  }

  static async addClusterMember(
    ns,
    conf = {},
    debug = false,
  ) {
    if (ns.cluster === undefined) {
      return Promise.reject(new Error("no cluster port on server"));
    }
    conf = conf || {};
    conf = Object.assign({}, conf);
    conf.port = -1;
    conf.cluster = conf.cluster || {};
    conf.cluster.name = ns.clusterName;
    conf.cluster.listen = conf.cluster.listen || "127.0.0.1:-1";
    conf.cluster.routes = [`nats://${ns.hostname}:${ns.cluster}`];
    return NatsServer.start(conf, debug);
  }

  static async localClusterFormed(servers) {
    const ports = servers.map((s) => s.port);

    const fn = async function (s) {
      const dp = deferred();
      const to = timeout(5000);
      let done = false;
      to.catch((err) => {
        done = true;
        dp.reject(
          new Error(
            `${s.hostname}:${s.port} failed to resolve peers: ${err.toString}`,
          ),
        );
      });

      while (!done) {
        const data = await s.varz();
        if (data) {
          const urls = data.connect_urls;
          const others = urls.map((s) => {
            return parseHostport(s)?.port;
          });

          if (others.every((v) => ports.includes(v))) {
            dp.resolve();
            to.cancel();
            break;
          }
        }
        await delay(100);
      }
      return dp;
    };
    const proms = servers.map((s) => fn(s));
    return Promise.all(proms);
  }
};

function toConf(o = {}, indent = "") {
  const pad = indent !== undefined ? indent + "  " : "";
  const buf = [];
  for (const k in o) {
    if (Object.prototype.hasOwnProperty.call(o, k)) {
      //@ts-ignore: tsc,
      const v = o[k];
      if (Array.isArray(v)) {
        buf.push(`${pad}${k} [`);
        buf.push(toConf(v, pad));
        buf.push(`${pad} ]`);
      } else if (typeof v === "object") {
        // don't print a key if it is an array and it is an index
        const kn = Array.isArray(o) ? "" : k;
        buf.push(`${pad}${kn} {`);
        buf.push(toConf(v, pad));
        buf.push(`${pad} }`);
      } else {
        if (!Array.isArray(o)) {
          if (
            typeof v === "string" && v.startsWith("$JS.")
          ) {
            buf.push(`${pad}${k}: "${v}"`);
          } else if (
            typeof v === "string" && v.charAt(0) >= "0" && v.charAt(0) <= "9"
          ) {
            buf.push(`${pad}${k}: "${v}"`);
          } else {
            buf.push(`${pad}${k}: ${v}`);
          }
        } else {
          buf.push(pad + v);
        }
      }
    }
  }
  return buf.join("\n");
}

exports.toConf = toConf;
