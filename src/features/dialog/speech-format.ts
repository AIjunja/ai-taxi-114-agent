const DIGITS = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']

function readDigits(s: string): string {
  return [...s].map((c) => DIGITS[Number(c)] ?? c).join('')
}

/** "12가 3456" → "일이, 가, 삼사오육". 전화로 들을 때 헷갈리지 않게 한 자씩 읽는다. */
export function speakPlate(plate: string): string {
  const m = plate.replace(/\s/g, '').match(/^(\d{2,3})([가-힣])(\d{4})$/)
  if (!m) return plate
  return `${readDigits(m[1])}, ${m[2]}, ${readDigits(m[3])}`
}

/** 받침에 맞춰 '으로/로'를 붙인다. ㄹ 받침은 '로'. */
export function withRo(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}로`
  const jong = code % 28
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`
}
