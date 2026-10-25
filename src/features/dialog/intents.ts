import { normalize } from './places'

export type YesNo = 'yes' | 'no' | 'unknown'

const NO = /^(아니|아뇨|아냐|틀려|틀렸|싫어|안부를|안불러|그거아니)/
const YES = /^(네|예|응|맞|그래|그렇|좋아|부탁|불러|ㅇㅇ|오케이|ok)/

export function parseYesNo(text: string): YesNo {
  const t = normalize(text)
  if (NO.test(t)) return 'no'
  if (YES.test(t)) return 'yes'
  return 'unknown'
}

export function isCancel(text: string): boolean {
  return /취소|그만|안탈래|끊을게/.test(normalize(text))
}

export function isRestart(text: string): boolean {
  return /^(다시|처음부터)/.test(normalize(text))
}
