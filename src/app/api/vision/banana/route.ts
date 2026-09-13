import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const publicDir = join(process.cwd(), 'public');
    const imgPath = join(publicDir, 'banana_generated.png');
    const jsonPath = join(publicDir, 'banana_ocr_result.json');
    const defaultVideoPath = join(publicDir, 'osiris_ai_generated.mp4');
    const legacyVideoPath = join(publicDir, 'banana_generated.mp4');

    const imageExists = existsSync(imgPath);
    const videoExists = existsSync(defaultVideoPath) || existsSync(legacyVideoPath);
    const activeVideoUrl = existsSync(defaultVideoPath) ? '/osiris_ai_generated.mp4' : (existsSync(legacyVideoPath) ? '/banana_generated.mp4' : null);
    
    let latestPlan = null;
    const planPath = defaultVideoPath + '.json';
    if (existsSync(planPath)) {
      try {
        latestPlan = JSON.parse(readFileSync(planPath, 'utf-8'));
      } catch {}
    }

    let ocrResults = [];
    if (existsSync(jsonPath)) {
      try {
        ocrResults = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      } catch {}
    }

    return NextResponse.json({
      status: 'ok',
      imageUrl: imageExists ? '/banana_generated.png' : null,
      videoUrl: activeVideoUrl,
      directorEngine: 'Apple Silicon MLX-LM (Qwen Autonomous Director)',
      pipelineStages: [
        { stage: 1, name: 'LTX-Video 0.9B', role: '초벌 궤적 및 카메라 모션 프리뷰 (Draft Layout)' },
        { stage: 2, name: 'CogVideoX-2B', role: '3D Causal VAE 시공간 일관성 합성 (Temporal Coherence)' },
        { stage: 3, name: 'Wan 2.1 1.3B', role: 'SOTA Flow Matching 질감 및 텍스처 마스터 렌더링 (Refinement)' }
      ],
      ocrEngine: 'GitHub EasyOCR (JaidedAI/EasyOCR - 23k+ Stars)',
      vlmModel: 'Apple MLX-VLM (Qwen2-VL-7B 4-bit)',
      plan: latestPlan,
      ocrResults
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let prompt = '한반도 야간 상공 정찰위성 궤도 뷰';
    let motion = 'orbit';

    try {
      const body = await req.json();
      if (body.prompt && body.prompt.trim()) {
        prompt = body.prompt.trim();
      }
      if (body.motion) {
        motion = body.motion;
      }
    } catch {}

    const timestamp = Date.now();
    const outputFilename = `osiris_video_${timestamp}.mp4`;
    const publicDir = join(process.cwd(), 'public');
    const outputPath = join(publicDir, outputFilename);
    const scriptPath = join(process.cwd(), 'scripts', 'ai_video_director.py');

    const { execSync } = await import('child_process');
    const safePrompt = prompt.replace(/"/g, '\\"');
    
    // Execute Local AI Director & Video Synthesis on M5
    execSync(
      `/Users/ohmylove303naver.com/mlx-env/bin/python "${scriptPath}" --prompt "${safePrompt}" --motion "${motion}" --output "${outputPath}"`,
      { shell: '/bin/zsh' }
    );

    let plan = null;
    const metaPath = outputPath + '.json';
    if (existsSync(metaPath)) {
      try {
        plan = JSON.parse(readFileSync(metaPath, 'utf-8'));
      } catch {}
    }

    return NextResponse.json({
      status: 'ok',
      videoUrl: `/${outputFilename}`,
      prompt,
      motion,
      plan,
      message: '로컬 AI 자율 기획 3단계 영상이 성공적으로 제작되었습니다.'
    });
  } catch (err: any) {
    console.error('Video generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

