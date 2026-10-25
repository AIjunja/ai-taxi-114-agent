// 자동 시연에 필요한 대사 목록을 JSON으로 출력한다 (음성 생성 스크립트 입력)
import { allLines, clipId } from '../src/features/demo/script'
const lines = allLines().map((l) => ({ id: clipId(l.speaker, l.text), ...l }))
process.stdout.write(JSON.stringify(lines))
