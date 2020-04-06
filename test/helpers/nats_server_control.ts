/*
 * Copyright 2018-2020 The NATS Authors
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

import { ChildProcess, spawn } from 'child_process'
import * as net from 'net'
import { Socket } from 'net'
import path from 'path'
import fs from 'fs'
import { Nuid } from 'js-nuid'
import { jsonToNatsConf, writeFile } from './nats_conf_utils'
import Timer = NodeJS.Timer

let SERVER = (process.env.TRAVIS) ? 'nats-server/nats-server' : 'nats-server'
let PID_DIR = (process.env.TRAVIS) ? process.env.TRAVIS_BUILD_DIR : process.env.TMPDIR

// context for tests
export interface SC {
  server: Server
}

export interface Server extends ChildProcess {
  args: string[]
  ws: string
  nats: string
}

export function getPort (urlString: string): number {
  let u = new URL(urlString)
  return parseInt(u.port, 10)
}

export function startServer (conf?: any): Promise<Server> {
  let port: number
  return new Promise((resolve, reject) => {
    if (conf === undefined) {
      conf = {}
    }
    conf.ports_file_dir = PID_DIR
    conf.port = conf.port || -1
    conf.websocket = conf.websocket || {}
    conf.websocket.port = conf.websocket.port || -1
    if (!conf.websocket.tls) {
      conf.websocket.tls = {}
      conf.websocket.tls.cert_file = path.join(__dirname, 'certs/server.pem')
      conf.websocket.tls.key_file = path.join(__dirname, 'certs/key.pem')
      conf.websocket.tls.ca_file = path.join(__dirname, 'certs/ca.pem')
    }

    let CONF_DIR = (process.env.TRAVIS) ? process.env.TRAVIS_BUILD_DIR : process.env.TMPDIR
    //@ts-ignore
    let fp = path.join(CONF_DIR, new Nuid().next() + '.conf')
    writeFile(fp, jsonToNatsConf(conf))

    const args = ['-c', fp]
    let server = spawn(SERVER, args) as Server
    server.args = args

    if (process.env.PRINT_LAUNCH_CMD) {
      console.log('server using configuration file', fp)
    }

    let start = Date.now()
    let wait: number = 0
    let maxWait = 5 * 1000 // 5 secs
    let delta = 250
    let socket: Socket | null
    let timer: Timer | null

    //@ts-ignore
    // server.stderr.on('data', function (data) {
    //     let lines = data.toString().split('\n')
    //     lines.forEach((m: string) => {
    //         console.log(m)
    //     })
    // })

    function resetSocket () {
      if (socket) {
        socket.removeAllListeners()
        socket.destroy()
        socket = null
      }
    }

    function finish (err?: Error) {
      resetSocket()
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      if (err === undefined) {
        // return where the ws is running
        resolve(server)
        return
      }
      reject(err)
    }

    let count = 50
    new Promise<any>((r, x) => {
      let t = setInterval(() => {
        --count
        if (count === 0) {
          clearInterval(t)
          x('Unable to find the pid')
        }
        //@ts-ignore
        let portsFile = path.join(PID_DIR, `nats-server_${server.pid}.ports`)
        if (fs.existsSync(portsFile)) {
          const ports = JSON.parse(fs.readFileSync(portsFile).toString())
          if (ports.nats && ports.nats.length) {
            (server as Server).nats = ports.nats[0]
          }
          if (ports.websocket && ports.websocket.length) {
            (server as Server).ws = ports.websocket[0]
          }
          port = getPort(server.ws)
          clearInterval(t)
          r()
        }

      }, 150)
    }).then(() => {
      // Test for when socket is bound.
      timer = <any>setInterval(function () {
        resetSocket()

        wait = Date.now() - start
        if (wait > maxWait) {
          finish(new Error('Can\'t connect to server on port: ' + port))
        }

        // Try to connect to the correct port.
        socket = net.createConnection(port)

        // Success
        socket.on('connect', function () {
          if (server.pid === null) {
            // We connected but not to our server..
            finish(new Error('Server already running on port: ' + port))
          } else {
            finish()
          }
        })

        // Wait for next try..
        socket.on('error', function (error) {
          finish(new Error('Problem connecting to server on port: ' + port + ' (' + error + ')'))
        })

      }, delta)
    })
      .catch((err) => {
        reject(err)
      })

    // Other way to catch another server running.
    server.on('exit', function (code, signal) {
      if (code === 1) {
        finish(new Error('Server exited with bad code, already running? (' + code + ' / ' + signal + ')'))
      }
    })

    // Server does not exist..
    // @ts-ignore
    server.stderr.on('data', function (data) {
      if (/^execvp\(\)/.test(data.toString())) {
        if (timer) {
          clearInterval(timer)
        }
        finish(new Error('Can\'t find the ' + SERVER))
      }
    })
  })

}

function wait (server: Server, done?: Function): void {
  if (server.killed) {
    if (done) {
      done()
    }
  } else {
    setTimeout(function () {
      wait(server, done)
    }, 0)
  }
}

export function stopServer (server: Server | null, done?: Function): void {
  if (server && !server.killed) {
    server.kill()
    wait(server, done)
  } else if (done) {
    done()
  }
}
