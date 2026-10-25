# 114 상담원 반복 업무 줄이기 PoC

02-114 '택시 대신 불러주기'에서 **상담원의 반복 업무(받아 적기·검색 입력·호출 화면 조작·결과 안내)를 얼마나 줄일 수 있는지** 검증하는 개인 PoC예요.
KT IS의 공식 사업이 아니고, 실제 택시 호출·결제·카카오 T 연동은 하지 않아요.

- 공개 페이지 (시연 영상): https://ai-taxi-114-agent.vercel.app
- 직접 조작 화면 (링크 없이 유지): `/lab` · 호출 콘솔: `/console` · 음성 진단: `/diagnostics`
- 시연 영상 만들기: `npx tsx scripts/make-demo-video.ts` (로컬 서버, ffmpeg, 이 PC의 OPENAI_API_KEY 필요. 키는 사이트에 올리지 않아요)
- 판단 기록: [docs/decision-log.md](docs/decision-log.md) · 면접 메모: [docs/interview-qa.md](docs/interview-qa.md)

## 기본 시나리오: 상담원 보조

1. 고객이 한 말 (예시 통화, 직접 입력, 또는 받아쓰기)
2. AI가 출발지·목적지를 **제안** — 근거(몇 번째 말, 어떤 표현)와 함께. 이름이 겹치면 후보, 모르면 '모름'
3. 상담원이 확인·수정
4. 상담원이 고객 최종 승인을 받음
5. Playwright가 서버 Chromium으로 Mock 호출 콘솔에 입력하고 호출 버튼을 누름 (화면 실시간 전송)
6. 상담원이 준비된 안내 문구를 읽음

비교용으로 처음 만든 **완전 자동**(AI 음성 상담원이 혼자 처리)도 그대로 남겨 두었어요.

## 실험 결과 요약 (2026-10-25)

| 실험 | 결과 |
|---|---|
| 장소 정리 정확도 | 1차 26/34 → 규칙 수정 후 같은 데이터 32/34 → **처음 보는 16건 13/16** (자신 있게 틀림 3칸) |
| 공개 서버 Playwright 입력·호출 | 6/6 성공, 평균 11.6초. 동시 실행 제한은 인스턴스마다라 **실패** |
| 상담원 조작 수 | 수동 13~18회 → 보조 4~5회 (시간은 재지 못함) |
| 음성 인식 | **검증 실패** — Chrome(자동화) 결과 없음, Edge network 오류, 사용자 직접 시도 실패 |
| 음성 합성 | 사이트 안: 기기 합성음 1개(사람 수준 주장 안 함). 시연 영상: OpenAI TTS로 미리 만든 음성 |
| 자동 테스트 | 단위 63, E2E 로컬 41, E2E 공개 URL 40 통과 |

발화 데이터는 직접 만든 예시예요(실제 녹취 아님).

## 코드 구조

```
src/features/assist     상담원 보조: 장소 정리(extract.ts), 실험 데이터, 화면
src/features/dialog     장소 목록, 대화 엔진(완전 자동용)
src/features/call       완전 자동 음성 통화, 업무 자동화 패널
src/features/console    Mock 택시 호출 콘솔 (Playwright가 조작하는 화면)
src/features/diagnostics 음성 진단 (/diagnostics)
src/features/roi        비용 계산: assist-roi.ts(기본), roi.ts(완전 자동 대체, 참고)
src/features/report     적용 전후·실험 결과·판단 기록 (/lab)
src/features/showcase   공개 첫 페이지 (시연 영상)
src/components/RealMap  실제 지도 (Leaflet + OpenStreetMap)
server/                 Mock 배차, Worker 공통 코드
api/                    Vercel Functions (/api/dispatch, /api/worker)
scripts/                실험·녹화·진단 스크립트
```

## 실행과 실험 재현

```bash
npm install && npx playwright install chromium
npm run dev
npm test                                   # 단위 테스트
npm run test:e2e                           # E2E
npx tsx scripts/run-experiments.ts         # 실험 1 (SET=holdout 이면 새 발화)
npx tsx scripts/worker-trials.ts           # 실험 2 (공개 서버)
npx tsx scripts/measure-actions.ts         # 실험 3 (로컬 서버)
WAV=... npx tsx scripts/diagnose-voice.ts  # 실험 4
```

## 안전장치

- 상담원 확인과 고객 승인 전에는 실행 버튼이 잠겨 있고, Worker·배차 API도 승인 없는 요청을 거절해요
- Worker는 이 배포 주소만 열고 다른 주소 요청은 막아요. IP별 10분 8회, 50초 제한
- 음성·대화를 저장하지 않아요
