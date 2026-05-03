import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const exe = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'Apophysis7X64.exe'))

function findNearbyStrings(buf, searchStr, contextBytes = 300) {
  const pattern = Buffer.alloc(searchStr.length * 2)
  for (let i = 0; i < searchStr.length; i++) pattern.writeUInt16LE(searchStr.charCodeAt(i), i * 2)

  const nearby = new Set()
  for (let i = 0; i <= buf.length - pattern.length; i++) {
    let match = true
    for (let j = 0; j < pattern.length; j++) {
      if (buf[i + j] !== pattern[j]) { match = false; break }
    }
    if (!match) continue

    const start = Math.max(0, i - contextBytes)
    const end = Math.min(buf.length, i + pattern.length + contextBytes)

    let s = start
    while (s < end) {
      let ch = buf.readUInt16LE(s)
      if (ch >= 32 && ch < 127) {
        let str = ''
        let p = s
        while (p < end && p + 1 < buf.length) {
          ch = buf.readUInt16LE(p)
          if (ch >= 32 && ch < 127) { str += String.fromCharCode(ch); p += 2 }
          else break
        }
        if (str.length >= 3 && str !== searchStr) nearby.add(str)
        s = p + 2
      } else {
        s += 2
      }
    }
  }
  return [...nearby].sort()
}

const vars = ['rings', 'fan', 'perspective', 'cell', 'split']
for (const v of vars) {
  const nearby = findNearbyStrings(exe, v)
  console.log(`\n=== Near "${v}" ===`)
  const likely = nearby.filter(s => s.includes('_') || s.length < 20)
  for (const s of likely) console.log(`  ${s}`)
}
