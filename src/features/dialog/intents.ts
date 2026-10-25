import { normalize } from './places'

export type YesNo = 'yes' | 'no' | 'unknown'

const NO = /^(아니|아뇨|아냐|틀려|틀렸|싫어|안부를|안불러|그거아니|노$)/
const YES = /^(네|예|응|맞|그래|그렇|좋아|부탁|불러|ㅇㅇ|오케이|ok|잘들려|들려|들립니다|들려요)/

export function parseYesNo(text: string): YesNo {
  const t = normalize(text)
  if (NO.test(t)) return 'no'
  if (YES.test(t)) return 'yes'
  return 'unknown'
}

const has = (text: string, re: RegExp) => re.test(normalize(text))

export const isCancel = (t: string) => has(t, /취소|그만할|그만둘|안탈래|필요없|끊을게/)
export const isRestart = (t: string) => has(t, /^(다시|처음부터|새로)/)
export const isRepeat = (t: string) => has(t, /다시말|뭐라고|뭐라구|못들었|한번더말|다시한번|다시들려|못알아들/)
export const isSlower = (t: string) => has(t, /천천히|너무빨|빨라요|빠르다/)
export const isCantHear = (t: string) => has(t, /안들려|잘안들|작아|크게|소리가작/)
export const isAgent = (t: string) => has(t, /상담원|사람이랑|사람바꿔|직원/)

const ORIGIN_WORD = /출발|타는곳|타실곳|탈곳|타는데|출발지/
const DEST_WORD = /목적지|가는곳|가실곳|도착|갈곳|가는데|행선지/
const CHANGE_WORD = /바꾸|바꿔|바꿀|바꾼|변경|수정|잘못|틀렸|다른데/

export function changeTarget(text: string): 'origin' | 'destination' | null {
  const t = normalize(text)
  const change = CHANGE_WORD.test(t)
  if (ORIGIN_WORD.test(t) && (change || t.length <= 6)) return 'origin'
  if (DEST_WORD.test(t) && (change || t.length <= 6)) return 'destination'
  return null
}

/** "강남역으로 바꿔 주세요", "아니 서울역으로 가 주세요" 처럼 목적지를 새로 말한 경우 */
export function soundsLikeNewDestination(text: string): boolean {
  return has(text, /(으로|로)(가|바꿔|변경|해|가주|가줘|갈게|부탁)|바꿔|변경/)
}
