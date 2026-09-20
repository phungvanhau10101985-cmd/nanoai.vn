import { writeFileSync } from 'fs'

const COPY = {
  brand: 'gudo.vn',
  slogan: 'gudo.vn - hang chat gia tot',
}

writeFileSync('tmp-patch-gudo-footer.cjs', 'console.log(' + JSON.stringify(COPY) + ')\n', 'utf8')
console.log('ok')
