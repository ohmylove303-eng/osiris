import React from 'react';
import TacticalArSimulator from '@/components/TacticalArSimulator';

export const metadata = {
  title: '👨‍🎓 교육생 실전 관측 훈련 모드 | 번개의 눈동자 Tactical AR',
  description: '교관이 일치화 전송한 표적 관측, 조준, JFIRE 화력요구 훈련 및 평가 점수판',
};

export default function TraineePage() {
  return (
    <main className="w-full min-h-screen bg-black">
      <TacticalArSimulator forcedRole="trainee" />
    </main>
  );
}
