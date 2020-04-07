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

const Payload = nats.Payload
const me = Date.now()

// create a connection, and register listeners
const init = async function () {
  // if the connection doesn't resolve, an exception is thrown
  // a real app would allow configuring the URL
  const conn = await nats.connect({ url: 'wss://localhost:9222', payload: Payload.JSON })

  // handle errors sent by the gnatsd - permissions errors, etc.
  conn.addEventListener('error', (ex) => {
    addEntry(`Received error from NATS: ${ex}`)
  })

  // handle connection to the server is closed - should disable the ui
  conn.addEventListener('close', () => {
    addEntry('NATS connection closed')
  })

  // the chat application listens for messages sent under the subject 'chat'
  conn.subscribe('chat', (msg) => {
    addEntry(msg.data.id === me ? `(me): ${msg.data.m}` : `(${msg.data.id}): ${msg.data.m}`)
  })

  // when a new browser joins, the joining browser publishes an 'enter' message
  conn.subscribe('enter', (msg) => {
    if (msg.data.id !== me) {
      addEntry(`${msg.data.id} entered.`)
    }
  })

  // when a browser closes, the leaving browser publishes an 'exit' message
  conn.subscribe('exit', (msg) => {
    if (msg.data.id !== me) {
      addEntry(`${msg.data.id} exited.`)
    }
  })

  // we connected, and we publish our enter message
  conn.publish('enter', { id: me })
  return conn
}

init().then(conn => {
  window.nc = conn
}).catch(ex => {
  addEntry(`Error connecting to NATS: ${ex}`)
})

// this is the input field
let input = document.getElementById('data')

// add a listener to detect edits. If they hit Enter, we publish it
input.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('send').click()
  } else {
    e.preventDefault()
  }
})

// send a message if user typed one
function send () {
  input = document.getElementById('data')
  const m = input.value
  if (m !== '' && window.nc) {
    window.nc.publish('chat', { id: me, m: m })
    input.value = ''
  }
  return false
}

// send the exit message
function exiting () {
  if (window.nc) {
    window.nc.publish('exit', { id: me })
  }
}

// add an entry to the document
function addEntry (s) {
  const p = document.createElement('pre')
  p.appendChild(document.createTextNode(s))
  document.getElementById('chats').appendChild(p)
}
