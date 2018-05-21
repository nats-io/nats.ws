/*
 * Copyright 2013-2018 The NATS Authors
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

import {PathLike, writeFileSync} from "fs";

// TODO: add array support
export function jsonToYaml(o: object, indent?: string): string {
    let pad = arguments[1] !== undefined ? arguments[1] + '  ' : '';
    let buf = [];
    for (let k in o) {
        if (o.hasOwnProperty(k)) {
            //@ts-ignore
            let v = o[k];
            if (Array.isArray(v)) {
                buf.push(pad + k + ' [');
                buf.push(jsonToYaml(v, pad));
                buf.push(pad + ' ]');
            } else if (typeof v === 'object') {
                // don't print a key if it is an array and it is an index
                let kn = Array.isArray(o) ? '' : k;
                buf.push(pad + kn + ' {');
                buf.push(jsonToYaml(v, pad));
                buf.push(pad + ' }');
            } else {
                if (!Array.isArray(o)) {
                    buf.push(pad + k + ': ' + v);
                } else {
                    buf.push(pad + v);
                }
            }
        }
    }
    return buf.join('\n');
}

export function writeFile(fn: PathLike, data: any) {
    writeFileSync(fn, data);
}
