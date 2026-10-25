// 시연 영상 만들기: 상담원 보조 화면을 실제로 조작하며 녹화하고, OpenAI TTS 대사 음성과 자막을 합친다.
// 필요: npm run dev (로컬 서버, 로컬 Playwright Worker), ffmpeg, OPENAI_API_KEY (이 PC 환경변수, 사이트에는 올리지 않음)
//   npx tsx scripts/make-demo-video.ts
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { speakPlate } from '../src/features/dialog/speech-format'

const base = process.env.BASE ?? 'http://localhost:5173'
const work = process.env.WORK ?? 'C:/dev/video'
const outDir = path.resolve('public/media')
const VOICES = {
  counselor: { voice: 'coral', instructions: '차분하고 친절한 한국 콜센터 상담원. 어르신과 통화 중이라 또박또박, 조금 천천히, 밝은 목소리로 말해요.' },
  customer: { voice: 'ash', instructions: '70대 한국 할아버지. 전화로 택시를 부탁하는 중. 조금 느리고 편안한 말투, 과장하지 않아요.' },
} as const
type Speaker = keyof typeof VOICES

async function tts(speaker: Speaker, text: string): Promise<{ file: string; sec: number }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY가 없어요')
  const file = path.join(work, 'clips', `${speaker}-${createHash('sha1').update(text).digest('hex').slice(0, 10)}.mp3`)
  if (!existsSync(file)) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: VOICES[speaker].voice, input: text, instructions: VOICES[speaker].instructions, response_format: 'mp3' }),
    })
    if (!res.ok) throw new Error(`TTS 실패 ${res.status} ${await res.text()}`)
    await writeFile(file, Buffer.from(await res.arrayBuffer()))
  }
  const sec = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())
  return { file, sec }
}

await mkdir(path.join(work, 'clips'), { recursive: true })
await rm(path.join(work, 'raw'), { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

// 미리 만들 수 있는 대사
const LINES: { speaker: Speaker; text: string; utterance?: boolean }[] = [
  { speaker: 'counselor', text: '네, 114 택시 대신 불러드리기입니다. 어디서 타세요?' },
  { speaker: 'customer', text: '여기 서울역이에요.', utterance: true },
  { speaker: 'customer', text: '세브란스 병원 가야 돼요.', utterance: true },
  { speaker: 'counselor', text: '신촌 세브란스요, 강남 세브란스요?' },
  { speaker: 'customer', text: '신촌이요.', utterance: true },
  { speaker: 'counselor', text: '서울역에서 신촌세브란스병원으로 택시 불러드릴까요?' },
  { speaker: 'customer', text: '네, 불러 주세요.', utterance: true },
]
const clips = await Promise.all(LINES.map((l) => tts(l.speaker, l.text)))

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, recordVideo: { dir: path.join(work, 'raw'), size: { width: 1280, height: 800 } } })
const page = await context.newPage()
const t0 = Date.now()
const timeline: { at: number; file: string; sec: number; speaker: Speaker; text: string }[] = []
const pause = (ms: number) => page.waitForTimeout(ms)

async function sayLine(i: number) {
  const l = LINES[i]
  const c = clips[i]
  timeline.push({ at: (Date.now() - t0) / 1000, file: c.file, sec: c.sec, speaker: l.speaker, text: l.text })
  if (l.utterance) {
    await page.getByTestId('utterance-input').fill(l.text.replace(/\.$/, ''))
    await page.getByTestId('utterance-input').press('Enter')
  }
  await pause(c.sec * 1000 + 350)
}

await page.goto(`${base}/lab`, { waitUntil: 'networkidle' })
await pause(2500)
await sayLine(0)
await sayLine(1)
await sayLine(2)
await pause(1500) // AI 정리: 출발지 서울역, 목적지 후보 2곳
await sayLine(3)
await sayLine(4)
await page.getByTestId('pick-destination-severance').click()
await pause(700)
await page.getByTestId('confirm-origin').click()
await pause(600)
await page.getByTestId('confirm-destination').click()
await pause(900)
await sayLine(5)
await sayLine(6)
await page.getByTestId('assist-approved').check()
await pause(700)
await page.getByTestId('assist-run').click()
await page.getByTestId('assist-result').waitFor({ timeout: 90_000 })
await pause(800)

// 배차 결과를 읽어 안내 대사를 만든다
const resultText = (await page.getByTestId('assist-result').innerText()).replace(/\s+/g, ' ')
const eta = resultText.match(/약 (\d+)분/)?.[1] ?? ''
const plate = resultText.match(/차 번호는 (.+?)이에요/)?.[1] ?? ''
const car = resultText.match(/이에요\. (.+?)이에요/)?.[1] ?? ''
const statusOk = (await page.getByTestId('assist-result').getAttribute('data-status')) === 'assigned'
const finalLine = statusOk ? `택시가 잡혔어요. 약 ${eta}분 뒤에 도착해요. 차 번호는 ${plate}이에요. ${car}이에요.` : '지금 근처에 빈 택시가 없어요. 몇 분 뒤에 다시 불러드릴까요?'
const fin = await tts('counselor', finalLine)
timeline.push({ at: (Date.now() - t0) / 1000, file: fin.file, sec: fin.sec, speaker: 'counselor', text: finalLine })
await pause(fin.sec * 1000 + 400)
const thanks = await tts('customer', '고마워요.')
timeline.push({ at: (Date.now() - t0) / 1000, file: thanks.file, sec: thanks.sec, speaker: 'customer', text: '고마워요.' })
await pause(thanks.sec * 1000 + 2500)
const total = (Date.now() - t0) / 1000
await context.close()
await browser.close()
void speakPlate

// 자막 (화자 표시)
const srtTime = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000))
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, '0')}`
}
const subs = [
  { at: 0.3, end: 2.6, text: '개인 PoC · 실제 택시 호출 없음 · 목소리는 AI 합성음' },
  ...timeline.map((t) => ({ at: t.at, end: t.at + t.sec + 0.3, text: `${t.speaker === 'counselor' ? '상담원' : '고객'}: ${t.text}` })),
]
await writeFile(path.join(work, 'subs.srt'), subs.map((s, i) => `${i + 1}\n${srtTime(s.at)} --> ${srtTime(s.end)}\n${s.text}\n`).join('\n'))

// 음성 합치기
const raw = (await readdir(path.join(work, 'raw'))).find((f) => f.endsWith('.webm'))!
const inputs = ['-i', path.join(work, 'raw', raw), ...timeline.flatMap((t) => ['-i', t.file])]
const delays = timeline.map((t, i) => `[${i + 1}:a]adelay=${Math.round(t.at * 1000)}|${Math.round(t.at * 1000)},volume=1.6[a${i}]`).join(';')
const mix = `${timeline.map((_, i) => `[a${i}]`).join('')}amix=inputs=${timeline.length}:normalize=0[aout]`
const subsPath = path.join(work, 'subs.srt').replace(/\\/g, '/').replace(':', '\\:')
const style = "FontName=Malgun Gothic,FontSize=13,Bold=1,PrimaryColour=&H00FFFFFF,BackColour=&H99000000,BorderStyle=4,Outline=0,MarginV=18"
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', ...inputs,
  '-filter_complex', `${delays};${mix};[0:v]subtitles='${subsPath}':force_style='${style}'[vout]`,
  '-map', '[vout]', '-map', '[aout]', '-t', String(total),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
  path.join(outDir, 'demo.mp4'),
])
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(1, total - 6)), '-i', path.join(outDir, 'demo.mp4'), '-frames:v', '1', '-q:v', '3', path.join(outDir, 'demo-poster.jpg')])
await writeFile(path.join(outDir, 'demo.json'), JSON.stringify({ madeAt: new Date().toISOString(), seconds: Math.round(total), result: statusOk ? 'assigned' : 'no_taxi', lines: timeline.map((t) => ({ at: +t.at.toFixed(1), speaker: t.speaker, text: t.text })) }, null, 2) + '\n')
console.log(`영상 ${Math.round(total)}초 · 대사 ${timeline.length}개 · 결과 ${statusOk ? '배차' : '빈 차 없음'}`)
