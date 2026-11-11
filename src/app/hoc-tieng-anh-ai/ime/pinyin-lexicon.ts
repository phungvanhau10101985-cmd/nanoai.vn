export type PinyinWord = { text: string; freq: number; py: string }

export type PinyinLexicon = {
  byPy: Map<string, PinyinWord[]>
  byPrefix: Map<string, PinyinWord[]>
  logTotal: number
  syllables: readonly string[]
}

// Phrases the stock list misses. Frequencies sit below the common homophone
// so the frequent reading stays first, and the phrase still appears beside it.
const EXTRA: Array<[string, string, number]> = [
  ['jintian', '金田', 8000],
  ['dengjikou', '登机口', 9000],
]

const PINYIN_SYLLABLES: readonly string[] = ["a","ai","an","ang","ao","ba","bai","ban","bang","bao","bei","ben","beng","bi","bian","biao","bie","bin","bing","bo","bu","ca","cai","can","cang","cao","ce","cen","ceng","cha","chai","chan","chang","chao","che","chen","cheng","chi","chong","chou","chu","chuai","chuan","chuang","chui","chun","chuo","ci","cong","cou","cu","cuan","cui","cun","cuo","da","dai","dan","dang","dao","de","dei","deng","di","dia","dian","diao","die","ding","diu","dong","dou","du","duan","dui","dun","duo","e","ei","en","er","fa","fan","fang","fei","fen","feng","fo","fou","fu","ga","gai","gan","gang","gao","ge","gei","gen","geng","gong","gou","gu","gua","guai","guan","guang","gui","gun","guo","ha","hai","han","hang","hao","he","hei","hen","heng","hng","hong","hou","hu","hua","huai","huan","huang","hui","hun","huo","ji","jia","jian","jiang","jiao","jie","jin","jing","jiong","jiu","ju","juan","jue","jun","ka","kai","kan","kang","kao","ke","ken","keng","kong","kou","ku","kua","kuai","kuan","kuang","kui","kun","kuo","la","lai","lan","lang","lao","le","lei","leng","li","lia","lian","liang","liao","lie","lin","ling","liu","lo","long","lou","lu","luan","lue","lun","luo","lv","lve","m","ma","mai","man","mang","mao","me","mei","men","meng","mi","mian","miao","mie","min","ming","miu","mo","mou","mu","n","na","nai","nan","nang","nao","ne","nei","nen","neng","ng","ni","nian","niang","niao","nie","nin","ning","niu","nong","nou","nu","nuan","nue","nuo","nv","nve","o","ou","pa","pai","pan","pang","pao","pei","pen","peng","pi","pian","piao","pie","pin","ping","po","pou","pu","qi","qia","qian","qiang","qiao","qie","qin","qing","qiong","qiu","qu","quan","que","qun","ran","rang","rao","re","ren","reng","ri","rong","rou","ru","ruan","rui","run","ruo","sa","sai","san","sang","sao","se","sen","seng","sha","shai","shan","shang","shao","she","shei","shen","sheng","shi","shou","shu","shua","shuai","shuan","shuang","shui","shun","shuo","si","song","sou","su","suan","sui","sun","suo","ta","tai","tan","tang","tao","te","tei","teng","ti","tian","tiao","tie","ting","tong","tou","tu","tuan","tui","tun","tuo","wa","wai","wan","wang","wei","wen","weng","wo","wu","xi","xia","xian","xiang","xiao","xie","xin","xing","xiong","xiu","xu","xuan","xue","xun","ya","yan","yang","yao","ye","yi","yin","ying","yo","yong","you","yu","yuan","yue","yun","za","zai","zan","zang","zao","ze","zei","zen","zeng","zha","zhai","zhan","zhang","zhao","zhe","zhei","zhen","zheng","zhi","zhong","zhou","zhu","zhua","zhuai","zhuan","zhuang","zhui","zhun","zhuo","zi","zong","zou","zu","zuan","zui","zun","zuo"]

let cache: PinyinLexicon | null = null

export function parsePinyinLexicon(pack: string): PinyinLexicon {
  if (cache) return cache
  const byPy = new Map<string, PinyinWord[]>()
  let total = 0
  for (const line of pack.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split(' ')
    const py = parts[0]
    if (!py) continue
    const words: PinyinWord[] = []
    for (let i = 1; i + 1 < parts.length; i += 2) {
      const freq = Number(parts[i + 1])
      if (!parts[i] || !Number.isFinite(freq) || freq <= 0) continue
      words.push({ text: parts[i], freq, py })
      total += freq
    }
    if (!words.length) continue
    words.sort((a, b) => b.freq - a.freq)
    byPy.set(py, words)
  }
  for (const [py, text, freq] of EXTRA) {
    const list = byPy.get(py) || []
    if (!list.some((word) => word.text === text)) {
      list.push({ text, freq, py })
      list.sort((a, b) => b.freq - a.freq)
      byPy.set(py, list)
      total += freq
    }
  }
  const byPrefix = new Map<string, PinyinWord[]>()
  for (const words of byPy.values()) {
    for (const word of words) {
      if (word.py.length < 2 || word.freq < 80) continue
      const key = word.py.slice(0, 2)
      const bucket = byPrefix.get(key)
      if (bucket) bucket.push(word)
      else byPrefix.set(key, [word])
    }
  }
  for (const bucket of byPrefix.values()) bucket.sort((a, b) => b.freq - a.freq)
  cache = { byPy, byPrefix, logTotal: Math.log(total), syllables: PINYIN_SYLLABLES }
  return cache
}
