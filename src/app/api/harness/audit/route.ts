import { NextResponse } from 'next/server';
import { getLatestAuditReport, runAutonomousHarnessAudit, AuditTriggerType } from '@/lib/harness-auditor';

export const dynamic = 'force-dynamic';

export async function GET() {
  let report = getLatestAuditReport();

  // 최초 기동 시 또는 마지막 감사가 10분 이상 지났을 때 자동 자율 감사 트리거
  const now = Date.now();
  const reportTime = report ? new Date(report.timestamp).getTime() : 0;
  const isStale = now - reportTime > 10 * 60 * 1000;

  if (!report) {
    // 최초 기동 트리거 (SERVER_BOOT)
    report = await runAutonomousHarnessAudit('SERVER_BOOT');
  } else if (isStale) {
    // 10분 주기 정기 자동 순환 트리거 (SCHEDULED_10MIN)
    // 백그라운드로 실행하여 응답 지연 없이 캐시된 결과를 즉시 반환하고 다음 요청 시 갱신된 결과 전달
    runAutonomousHarnessAudit('SCHEDULED_10MIN').catch(() => {});
  }

  return NextResponse.json({
    status: 'success',
    report,
    meta: {
      is_stale: isStale,
      current_time: new Date().toISOString(),
      current_time_kst: new Date(Date.now() + 9 * 3600000).toISOString().replace('Z', '+09:00'),
    },
  }, {
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const trigger: AuditTriggerType = body.trigger || 'OPERATOR_ON_DEMAND';
    const customReason: string | undefined = body.reason;

    const report = await runAutonomousHarnessAudit(trigger, customReason);
    return NextResponse.json({ status: 'success', report });
  } catch (error: unknown) {
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Audit failed' },
      { status: 500 }
    );
  }
}
