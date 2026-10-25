# 자동 시연 대사 음성 생성 (lines.json → mp3 + manifest.json)
# 사용: npx tsx scripts/list-demo-lines.ts > lines.json
#       python -m pip install edge-tts  (별도 가상환경 권장)
#       python scripts/gen-demo-voice.py lines.json public/audio/demo2
import asyncio, json, os, subprocess, sys
import edge_tts
LINES, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
V = {
  'agent': dict(voice='ko-KR-SunHiNeural', rate='-5%', pitch='+0Hz'),
  'counselor': dict(voice='ko-KR-SunHiNeural', rate='-8%', pitch='-2Hz'),
  'customer': dict(voice='ko-KR-InJoonNeural', rate='-18%', pitch='-10Hz'),
}
lines = json.load(open(LINES, encoding='utf-8'))
async def one(l):
    p = os.path.join(OUT, l['id'] + '.mp3')
    if not os.path.exists(p):
        v = V[l['speaker']]
        raw = p + '.raw.mp3'
        await edge_tts.Communicate(l['text'], v['voice'], rate=v['rate'], pitch=v['pitch']).save(raw)
        # 앞뒤 무음을 잘라 한 자씩 끊어 읽을 때도 자연스럽게
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',raw,'-af','silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse','-b:a','64k',p], check=True)
        os.remove(raw)
    sec = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).decode().strip())
    return l['id'], round(sec, 2)
async def main():
    sem = asyncio.Semaphore(6)
    async def g(l):
        async with sem: return await one(l)
    res = await asyncio.gather(*[g(l) for l in lines])
    json.dump({'engine': 'edge-tts (Microsoft 신경망 음성)', 'clips': dict(res)}, open(os.path.join(OUT,'manifest.json'),'w',encoding='utf-8'), ensure_ascii=False)
    print(len(res))
asyncio.run(main())
