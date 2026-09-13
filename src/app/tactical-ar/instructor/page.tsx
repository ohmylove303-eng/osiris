import React from 'react';
import TacticalArSimulator from '@/components/TacticalArSimulator';

export const metadata = {
  title: '🎖️ 교관 전술 통제 모드 | 번개의 눈동자 Tactical AR',
  description: '교관 전용 표적 배치, 9개소 기동로, 각도 및 속도 설정 후 교육생 화면 일치화 전송 시스템',
};

export default function InstructorPage() {
  return (
    <main className="w-full min-h-screen bg-black">
      <TacticalArSimulator forcedRole="instructor" />
    </main>
  );
}
