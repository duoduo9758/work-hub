// One-off SVG → PNG conversion for apple-touch-icon.
// Usage: node scripts/svg-to-png.mjs
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync('public/apple-touch-icon.svg', 'utf8')
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 180 },
  font: { loadSystemFonts: true },
})
const png = resvg.render().asPng()
writeFileSync('public/apple-touch-icon.png', png)
console.log('wrote public/apple-touch-icon.png:', png.length, 'bytes')
