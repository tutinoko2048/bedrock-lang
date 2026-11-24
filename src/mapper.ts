// TypeScript 7.1 content mapper for .lang files.
// TypeScript starts this process (package.json "typescript.contentMapper.exec")
// and talks JSON-RPC over stdio with LSP-style Content-Length framing.
import { generate, parse, type LangDiagnostic, type Mapping } from './lang';

type Encoding = 'utf-8' | 'utf-16';
let encoding: Encoding = 'utf-16';

type Handler = (params: any) => unknown;
const handlers: Record<string, Handler> = {
  initialize(params: { positionEncodings: Encoding[] }) {
    // UTF-16 matches JS string indexes, so prefer it and convert only when we must
    encoding = params.positionEncodings.includes('utf-16') ? 'utf-16' : 'utf-8';
    return { positionEncoding: encoding, diagnosticSource: 'bedrock-lang' };
  },
  openProject: () => ({}),
  closeProject: () => null,
  transform(params: { content: string }) {
    const { entries, diagnostics } = parse(params.content);
    const virtual = generate(entries, 'ts');
    if (encoding === 'utf-16') {
      return { text: virtual.text, extension: '.ts', mappings: virtual.mappings, diagnostics };
    }
    const v = utf8Offsets(virtual.text);
    const o = utf8Offsets(params.content);
    return {
      text: virtual.text,
      extension: '.ts',
      mappings: virtual.mappings.map(([vs, vl, os, ol, kind]): Mapping => [
        v(vs),
        v(vs + vl) - v(vs),
        o(os),
        o(os + ol) - o(os),
        kind,
      ]),
      diagnostics: diagnostics.map((d): LangDiagnostic => ({
        ...d,
        start: o(d.start),
        length: o(d.start + d.length) - o(d.start),
      })),
    };
  },
};

/** UTF-16 index -> UTF-8 byte offset for one text. */
const utf8Offsets = (text: string) => {
  const table = new Uint32Array(text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    // A surrogate pair is 4 bytes; count 2 per half
    table[i + 1] = table[i]! + (c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c <= 0xdfff ? 2 : 3);
  }
  return (i: number) => table[i]!;
};

const send = (message: object) => {
  const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }));
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
};

let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;
    const length = Number(
      /Content-Length:\s*(\d+)/i.exec(buffer.subarray(0, headerEnd).toString())?.[1],
    );
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const request = JSON.parse(buffer.subarray(start, start + length).toString());
    buffer = buffer.subarray(start + length);

    const handler = handlers[request.method];
    if (request.id === undefined) continue; // notification
    if (!handler) {
      send({
        id: request.id,
        error: { code: -32601, message: `Method not found: ${request.method}` },
      });
      continue;
    }
    try {
      send({ id: request.id, result: handler(request.params) });
    } catch (error) {
      send({ id: request.id, error: { code: -32603, message: String(error) } });
    }
  }
});
