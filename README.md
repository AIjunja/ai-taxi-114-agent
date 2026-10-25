# 114 AI 택시 상담 PoC

02-114 '택시 대신 불러주기'를 AI 상담원이 처리하는 **개인 PoC**예요. 고객이 말하면 AI가 듣고 되묻고, 승인을 받으면 Playwright가 택시 호출 콘솔(Mock)을 실제 브라우저로 조작해 배차까지 처리해요.
KT IS·카카오모빌리티 공식 서비스가 아니고, 실제 택시 호출·결제·카카오 T 연동은 하지 않아요.

- 공개 데모: https://ai-taxi-114-agent.vercel.app
- 호출 콘솔: https://ai-taxi-114-agent.vercel.app/console
- 디자인 규칙: [DESIGN.md](DESIGN.md)

## 무엇이 실제고 무엇이 Mock인가

| 기능 | 상태 | 위치 |
|---|---|---|
| 음성 인식 (STT) | 실제 · 브라우저 Web Speech API | `src/lib/speech.ts` |
| 음성 합성 (TTS) | 실제 · 브라우저 Web Speech API | `src/lib/speech.ts` |
| 대화 엔진 | 실제 · 규칙 기반 (언어 모델 없음) | `src/features/dialog/` |
| 콘솔 자동화 | 실제 · Vercel 서버 Chromium + Playwright, 화면 실시간 전송 | `api/worker.ts`, `server/worker-core.ts` |
| 택시 호출 콘솔 | Mock 업무 웹 | `src/features/console/` |
| 배차 | Mock API (대기 → 배정 → 취소) | `api/dispatch.ts`, `server/dispatch-core.ts` |
| 자동 시연 | 고객 발화는 합성, 오른쪽 화면은 실제 Playwright 실행 녹화 | `src/features/call/demo.ts`, `public/evidence/` |
| 비용 계산 기본값 | 가정 (공개 기사 수치 + 일반 가정) | `src/features/roi/roi.ts` |

## 통화 흐름

1. 첫인사와 소리 확인 → 2. 출발지 듣기 → 3. 되읽기(겹치면 후보 제시) → 4. 목적지 → 5. 되읽기 → 6. 최종 확인 → 7. 승인 → 8. Worker가 콘솔 조작 → 9. 배차 결과 음성 안내 → 10. 필요하면 취소

어느 단계에서든 "뭐라고요?", "천천히 말해 주세요", "잘 안 들려요", "목적지 바꿀래요", "취소", "상담원"을 알아들어요.

## 실행

```bash
npm install
npx playwright install chromium
npm run dev              # http://localhost:5173 (로컬에서도 /api/worker가 실제 Chromium을 띄워요)
npm test                 # 단위 테스트
npm run test:e2e         # E2E (데스크톱·모바일)
npm run record:worker    # 자동 시연용 Playwright 실행 녹화 → public/evidence/
```

공개 URL 대상 E2E: `E2E_BASE_URL=https://ai-taxi-114-agent.vercel.app npm run test:e2e`

## 안전장치

- 승인 없는 호출 거절: 대화 엔진, Worker(403·브라우저 실행 전 거절), 배차 API(403)
- Worker는 이 배포 주소만 열고 다른 호스트 요청은 차단. 동시 1개, IP별 10분 8회, 50초 제한
- 같은 요청 키는 새로 배차하지 않음. 요청 ID는 서명해 위조를 막음
- `WORKER_DISABLED=1`, `DISPATCH_DISABLED=1`로 바로 멈출 수 있음. Worker를 못 쓰면 API로 호출하고 화면에 표시
- 음성·대화 미저장. 서버 로그에는 결과 종류만 남김

## 한계

- 자동화로 띄운 Chrome·Edge에서는 음성 인식 서버가 빈 결과를 돌려줘서, 실제 STT 인식은 자동 테스트로 검증하지 못했어요. STT 이후 흐름은 인식 대역으로 검증했어요.
- 음성 인식은 Chrome·Edge·Safari 중심이에요. Chrome·Edge는 인식을 위해 음성을 브라우저 회사 서버로 보내요.
- 알아듣는 장소는 데모용 29곳이에요. 언어 모델을 쓰지 않아 자유로운 표현은 못 알아들을 수 있어요.
- 요청량 제한은 서버리스 인스턴스 메모리 기준이에요.
