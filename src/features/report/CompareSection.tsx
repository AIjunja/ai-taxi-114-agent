// 적용 전후 비교: 기존 상담원 / 상담원 보조(기본) / 완전 자동(비교용)
const ROWS: { step: string; before: string; assist: string; auto: string }[] = [
  { step: '고객 말 듣기', before: '상담원이 듣고 메모', assist: '상담원이 듣고, 받아쓰기가 되면 화면에 적힘', auto: 'AI가 듣고 되물음' },
  { step: '출발지·목적지 정리', before: '상담원이 머릿속으로 정리', assist: 'AI가 정리해서 제안 · 근거 표시', auto: 'AI가 정리하고 되읽어 확정' },
  { step: '확인', before: '상담원이 되묻기', assist: '상담원이 제안을 보고 확인·수정', auto: '고객이 "네"라고 하면 확정' },
  { step: '호출 화면 입력', before: '상담원이 검색어 입력·선택·위치 확인', assist: 'Playwright가 입력 (상담원 조작 없음)', auto: 'Playwright가 입력' },
  { step: '호출 승인', before: '상담원이 판단', assist: '상담원이 고객 답을 듣고 체크', auto: '고객 "네"로 승인' },
  { step: '결과 안내', before: '상담원이 화면을 읽고 말함', assist: '상담원이 준비된 안내 문구를 읽음', auto: 'AI가 합성 음성으로 안내' },
  { step: '틀렸을 때', before: '상담원이 바로 알아챔', assist: '상담원 확인 단계에서 걸러짐', auto: '틀린 곳으로 호출될 수 있음 (실험 1)' },
]

export function CompareSection() {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-bg text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5">단계</th>
              <th className="px-4 py-2.5">지금 (상담원)</th>
              <th className="bg-accent-soft px-4 py-2.5 text-accent-strong">상담원 보조 · 이 PoC 기본</th>
              <th className="px-4 py-2.5">완전 자동 · 비교용</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.step} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-bold">{r.step}</td>
                <td className="px-4 py-3 text-muted">{r.before}</td>
                <td className="bg-accent-soft/40 px-4 py-3">{r.assist}</td>
                <td className="px-4 py-3 text-muted">{r.auto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-3 text-sm">
        <p className="rounded-xl border border-line bg-surface p-4">
          <b className="block">줄이려는 것</b>
          <span className="text-muted">상담원이 같은 순서로 반복하는 받아 적기, 검색어 입력, 결과 읽기. 판단은 사람에게 남겨요.</span>
        </p>
        <p className="rounded-xl border border-line bg-surface p-4">
          <b className="block">완전 자동을 기본으로 안 한 이유</b>
          <span className="text-muted">새 발화에서 틀린 장소를 자신 있게 채운 칸이 남았고(실험 1), 음성 인식을 검증하지 못했어요(실험 4).</span>
        </p>
        <p className="rounded-xl border border-line bg-surface p-4">
          <b className="block">완전 자동은 언제</b>
          <span className="text-muted">파일럿에서 '자신 있게 틀림'이 거의 없는 쉬운 통화 유형을 찾으면 그 유형만 단계적으로 넘겨요.</span>
        </p>
      </div>
    </div>
  )
}
