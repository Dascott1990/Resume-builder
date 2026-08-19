// ── Pure-JS ZIP (store method, no compression — DOCX doesn't need it) ─────────
export async function zipDocx(xml) {
  const enc = new TextEncoder();
  const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
  const u16 = (n) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };

  function crc32(bytes) {
    if (!crc32._t) {
      crc32._t = Array.from({ length: 256 }, (_, i) => {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        return c >>> 0;
      });
    }
    let c = 0xFFFFFFFF;
    for (const b of bytes) c = (crc32._t[(c ^ b) & 0xFF] ^ (c >>> 8)) >>> 0;
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const files = [
    ["[Content_Types].xml",          xml.contentTypes],
    ["_rels/.rels",                   xml.pkgRels],
    ["word/document.xml",            xml.doc],
    ["word/styles.xml",              xml.styles],
    ["word/numbering.xml",           xml.num],
    ["word/settings.xml",            xml.settings],
    ["word/_rels/document.xml.rels", xml.docRels],
    ["docProps/core.xml",            xml.core],
    ["docProps/app.xml",             xml.app],
  ];

  const entries = [];
  let offset = 0;
  const parts = [];

  for (const [name, text] of files) {
    const nameB = enc.encode(name);
    const data  = enc.encode(text);
    const crc   = crc32(data);
    const local = new Uint8Array(30 + nameB.length);
    const dv    = new DataView(local.buffer);
    dv.setUint32(0,  0x04034B50, true);  // signature — little-endian, like every field below it (this was previously `false`/big-endian, which put the four signature bytes on disk in reverse order: 04 03 4B 50 instead of the real "PK\x03\x04" — 50 4B 03 04 — silently producing a file no zip reader, and so no copy of Word, could ever open)
    dv.setUint16(4,  20, true);          // version needed
    dv.setUint16(6,  0,  true);          // flags
    dv.setUint16(8,  0,  true);          // method: store
    dv.setUint16(10, 0,  true);          // mod time
    dv.setUint16(12, 0,  true);          // mod date
    dv.setUint32(14, crc,         true); // CRC
    dv.setUint32(18, data.length, true); // compressed size
    dv.setUint32(22, data.length, true); // uncompressed size
    dv.setUint16(26, nameB.length,true); // filename length
    dv.setUint16(28, 0, true);           // extra field length
    local.set(nameB, 30);
    parts.push(local, data);
    entries.push({ nameB, crc, size: data.length, offset });
    offset += local.length + data.length;
  }

  const centralParts = entries.map(e => {
    const c = new Uint8Array(46 + e.nameB.length);
    const dv = new DataView(c.buffer);
    dv.setUint32(0,  0x02014B50, true); // signature — see local file header's own comment above on why this must be little-endian
    dv.setUint16(4,  20, true);
    dv.setUint16(6,  20, true);
    dv.setUint16(8,  0,  true);
    dv.setUint16(10, 0,  true);
    dv.setUint16(12, 0,  true);
    dv.setUint16(14, 0,  true);
    dv.setUint32(16, e.crc,         true);
    dv.setUint32(20, e.size,        true);
    dv.setUint32(24, e.size,        true);
    dv.setUint16(28, e.nameB.length,true);
    dv.setUint16(30, 0, true);
    dv.setUint16(32, 0, true);
    dv.setUint16(34, 0, true);
    dv.setUint16(36, 0, true);
    dv.setUint32(40, 0, true);
    dv.setUint32(42, e.offset, true);
    c.set(e.nameB, 46);
    return c;
  });

  const centralSize   = centralParts.reduce((s, c) => s + c.length, 0);
  const eocd          = new Uint8Array(22);
  const eocdDv        = new DataView(eocd.buffer);
  eocdDv.setUint32(0, 0x06054B50, true); // signature — see local file header's own comment above on why this must be little-endian
  eocdDv.setUint16(4, 0, true);
  eocdDv.setUint16(6, 0, true);
  eocdDv.setUint16(8,  entries.length, true);
  eocdDv.setUint16(10, entries.length, true);
  eocdDv.setUint32(12, centralSize,    true);
  eocdDv.setUint32(16, offset,         true);
  eocdDv.setUint16(20, 0, true);

  const all   = [...parts, ...centralParts, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const buf   = new Uint8Array(total);
  let   pos   = 0;
  for (const p of all) { buf.set(p, pos); pos += p.length; }
  return buf;
}
