'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, ExternalLink, CheckCircle2, AlertCircle, X, ShieldCheck, Bus, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function KoreaApiKeyModal({ isOpen, onClose }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [currentKey, setCurrentKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/transit/key')
        .then(r => r.json())
        .then(data => {
          if (data.isSet) {
            setCurrentKey(data.maskedKey);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setStatus('loading');
    setMessage('');
    setTestResult(null);

    try {
      const res = await fetch('/api/transit/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message);
        setTestResult(data.testResult);
        setCurrentKey(`${apiKey.slice(0, 6)}...${apiKey.slice(-6)}`);
        setApiKey('');
      } else {
        setStatus('error');
        setMessage(data.error || '저장에 실패했습니다.');
      }
    } catch {
      setStatus('error');
      setMessage('서버 통신 오류가 발생했습니다.');
    }
  };

  const handleTestCurrent = async () => {
    setStatus('loading');
    setMessage('');
    setTestResult(null);

    try {
      const res = await fetch('/api/transit/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: '__CURRENT__' }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus(data.testResult === 'VERIFIED_ACTIVE' ? 'success' : 'idle');
        setMessage(data.message);
        setTestResult(data.testResult);
      } else {
        setStatus('error');
        setMessage(data.error || '테스트 실패');
      }
    } catch {
      setStatus('error');
      setMessage('서버 통신 오류가 발생했습니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl bg-[#090d16] border border-cyan-500/40 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_24px_rgba(6,182,212,0.2)] p-6 font-mono text-xs overflow-hidden"
        >
          {/* Decorative scanner line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/50 text-cyan-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                  공공데이터포털(data.go.kr) API 키 연동
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    국토교통부 TAGO
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  실시간 국토교통부 버스 위치 정보 API 연동 및 자동 전환
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Status Box */}
          <div className="mt-4 p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 shrink-0 ${currentKey ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="text-gray-300">현재 보관된 서비스키:</span>
              <span className="text-cyan-300 font-bold">
                {currentKey ? currentKey : '미등록 (정밀 시뮬레이션 가동 중)'}
              </span>
            </div>
            {currentKey && (
              <button
                type="button"
                onClick={handleTestCurrent}
                disabled={status === 'loading'}
                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
                <span>포털 게이트웨이 동기화 확인</span>
              </button>
            )}
          </div>

          {/* Direct Portal Links */}
          <div className="mt-4 space-y-2">
            <div className="text-[11px] text-cyan-300 font-bold flex items-center gap-1.5">
              <span>🌐</span>
              <span>공공데이터포털 활용신청 바로가기 (1초 만에 자동 승인)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href="https://www.data.go.kr/data/15000551/openapi.do"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/60 transition-all text-cyan-200 group"
              >
                <div className="flex items-center gap-2">
                  <Bus className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="font-bold text-[11px] text-white group-hover:text-cyan-300">국토교통부 TAGO 버스</div>
                    <div className="text-[9px] text-gray-400">전국 실시간 버스위치정보</div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
              </a>

              <a
                href="https://www.data.go.kr/data/15080662/openapi.do"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 hover:border-purple-400 hover:bg-purple-950/60 transition-all text-purple-200 group"
              >
                <div className="flex items-center gap-2">
                  <Bus className="w-4 h-4 text-purple-400" />
                  <div>
                    <div className="font-bold text-[11px] text-white group-hover:text-purple-300">경기도 버스위치정보</div>
                    <div className="text-[9px] text-gray-400">김포·강화 주요 광역/시내버스</div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="mt-5 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-300 mb-1">
                공공데이터 일반 인증키 (Encoding 또는 Decoding) 입력:
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="공공데이터포털 마이페이지에서 발급받은 일반 인증키를 붙여넣으세요"
                className="w-full px-3.5 py-2.5 bg-black/60 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 text-xs font-mono"
              />
            </div>

            {/* Status Message */}
            {message && (
              <div className={`p-3 rounded-xl flex items-start gap-2 border ${
                status === 'success' 
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' 
                  : 'bg-red-950/40 border-red-500/50 text-red-200'
              }`}>
                {status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-[11px] font-semibold">{message}</p>
                  {testResult && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      실시간 TAGO 응답 상태: <span className="text-cyan-300 font-bold">{testResult}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-gray-300 transition-colors"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={status === 'loading' || !apiKey.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.4)]"
              >
                {status === 'loading' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>검증 및 저장 중...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>저장 및 실시간 연결</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Guide Footer */}
          <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-gray-400 leading-relaxed">
            💡 <strong>안내:</strong> 공공데이터포털에서 [활용신청] 버튼을 누르면 즉시 승인됩니다. 승인된 일반 인증키를 등록하시면 국토교통부 TAGO 실시간 버스 좌표로 즉시 자동 전환됩니다.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
