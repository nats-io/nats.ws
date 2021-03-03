/*
 * Copyright 2013-2021 The NATS Authors
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
export declare function connect(
  opts?: ConnectionOptions,
): Promise<NatsConnection>;

export interface NatsConnection {
  info?: ServerInfo;
  closed(): Promise<void | Error>;
  close(): Promise<void>;
  publish(subject: string, data?: Uint8Array, options?: PublishOptions): void;
  subscribe(subject: string, opts?: SubscriptionOptions): Subscription;
  request(
    subject: string,
    data?: Uint8Array,
    opts?: RequestOptions,
  ): Promise<Msg>;
  flush(): Promise<void>;
  drain(): Promise<void>;
  isClosed(): boolean;
  isDraining(): boolean;
  getServer(): string;
  status(): AsyncIterable<Status>;
  stats(): Stats;
}

export declare const Empty: Uint8Array;

export interface ConnectionOptions {
  authenticator?: Authenticator;
  debug?: boolean;
  ignoreClusterUpdates?: boolean;
  inboxPrefix?: string;
  maxPingOut?: number;
  maxReconnectAttempts?: number;
  name?: string;
  noEcho?: boolean;
  noRandomize?: boolean;
  pass?: string;
  pedantic?: boolean;
  pingInterval?: number;
  port?: number;
  reconnect?: boolean;
  reconnectDelayHandler?: () => number;
  reconnectJitter?: number;
  reconnectJitterTLS?: number;
  reconnectTimeWait?: number;
  servers?: Array<string> | string;
  timeout?: number;
  tls?: TlsOptions;
  token?: string;
  user?: string;
  verbose?: boolean;
  waitOnFirstConnect?: boolean;
}

export interface TlsOptions {
  certFile?: string;
  caFile?: string;
  keyFile?: string;
}

export declare enum Events {
  Disconnect = "disconnect",
  Reconnect = "reconnect",
  Update = "update",
  LDM = "ldm",
  Error = "error"
}

export declare enum DebugEvents {
  Reconnecting = "reconnecting",
  PingTimer = "pingTimer",
  StaleConnection = "staleConnection"
}

export interface Status {
  type: Events | DebugEvents;
  data: string | ServersChanged;
}

export interface Subscription extends AsyncIterable<Msg> {
  unsubscribe(max?: number): void;
  drain(): Promise<void>;
  isDraining(): boolean;
  isClosed(): boolean;
  callback(err: NatsError | null, msg: Msg): void;
  getSubject(): string;
  getReceived(): number;
  getProcessed(): number;
  getPending(): number;
  getID(): number;
  getMax(): number | undefined;
}

export interface SubscriptionOptions {
  queue?: string;
  max?: number;
  timeout?: number;
  callback?: (err: NatsError | null, msg: Msg) => void;
}

export interface RequestOptions {
  timeout: number;
  headers?: MsgHdrs;
  noMux?: boolean;
  reply?: string;
}

export interface PublishOptions {
  reply?: string;
  headers?: MsgHdrs;
}

export interface Msg {
  subject: string;
  sid: number;
  reply?: string;
  data: Uint8Array;
  headers?: MsgHdrs;
  respond(data?: Uint8Array, opts?: PublishOptions): boolean;
}

export interface MsgHdrs extends Iterable<[string, string[]]> {
  hasError: boolean;
  status: string;
  code: number;
  get(k: string): string;
  set(k: string, v: string): void;
  append(k: string, v: string): void;
  has(k: string): boolean;
  values(k: string): string[];
  delete(k: string): void;
}
export declare function headers(): MsgHdrs;

export interface ServersChanged {
  readonly added: string[];
  readonly deleted: string[];
}

export interface Authenticator {
  (nonce?: string): Auth;
}

export declare type NoAuth = void;
export interface TokenAuth {
  auth_token: string;
}
export interface UserPass {
  user: string;
  pass?: string;
}
export interface NKeyAuth {
  nkey: string;
  sig: string;
}
export interface JwtAuth {
  jwt: string;
  nkey?: string;
  sig?: string;
}
declare type Auth = NoAuth | TokenAuth | UserPass | NKeyAuth | JwtAuth;

export declare function noAuthFn(): Authenticator;

export declare function nkeyAuthenticator(
  seed?: Uint8Array | (() => Uint8Array),
): Authenticator;

export declare function jwtAuthenticator(
  ajwt: string | (() => string),
  seed?: Uint8Array | (() => Uint8Array),
): Authenticator;

export declare function credsAuthenticator(creds: Uint8Array): Authenticator;

export declare enum ErrorCode {
  // emitted by the client
  ApiError = "BAD API",
  BadAuthentication = "BAD_AUTHENTICATION",
  BadCreds = "BAD_CREDS",
  BadHeader = "BAD_HEADER",
  BadJson = "BAD_JSON",
  BadPayload = "BAD_PAYLOAD",
  BadSubject = "BAD_SUBJECT",
  Cancelled = "CANCELLED",
  ConnectionClosed = "CONNECTION_CLOSED",
  ConnectionDraining = "CONNECTION_DRAINING",
  ConnectionRefused = "CONNECTION_REFUSED",
  ConnectionTimeout = "CONNECTION_TIMEOUT",
  Disconnect = "DISCONNECT",
  InvalidOption = "INVALID_OPTION",
  InvalidPayload = "INVALID_PAYLOAD",
  MaxPayloadExceeded = "MAX_PAYLOAD_EXCEEDED",
  NoResponders = "NO_RESPONDERS",
  NotFunction = "NOT_FUNC",
  RequestError = "REQUEST_ERROR",
  ServerOptionNotAvailable = "SERVER_OPT_NA",
  SubClosed = "SUB_CLOSED",
  SubDraining = "SUB_DRAINING",
  Timeout = "TIMEOUT",
  Tls = "TLS",
  Unknown = "UNKNOWN_ERROR",
  WssRequired = "WSS_REQUIRED",

  // emitted by the server
  AuthorizationViolation = "AUTHORIZATION_VIOLATION",
  AuthenticationExpired = "AUTHENTICATION_EXPIRED",
  ProtocolError = "NATS_PROTOCOL_ERR",
  PermissionsViolation = "PERMISSIONS_VIOLATION"
}

export declare interface NatsError extends Error {
  name: string;
  message: string;
  code: string;
  chainedError?: Error;
}

export interface ServerInfo {
  auth_required?: boolean;
  client_id: number;
  client_ip?: string;
  connect_urls?: string[];
  git_commit?: string;
  go: string;
  headers?: boolean;
  host: string;
  jetstream?: boolean;
  ldm?: boolean;
  max_payload: number;
  nonce?: string;
  port: number;
  proto: number;
  server_id: string;
  server_name: string;
  tls_available?: boolean;
  tls_required?: boolean;
  tls_verify?: boolean;
  version: string;
}

export interface Stats {
  inBytes: number;
  outBytes: number;
  inMsgs: number;
  outMsgs: number;
}

export interface Codec<T> {
  encode(d: T): Uint8Array;
  decode(a: Uint8Array): T;
}
export declare function StringCodec(): Codec<string>;
export declare function JSONCodec<T = unknown>(): Codec<T>;
