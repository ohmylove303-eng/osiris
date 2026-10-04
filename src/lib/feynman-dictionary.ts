/**
 * ⚡ 번개의 눈동자 — 파인만 기법(Feynman Technique) 전술 UI 해설 사전
 * 
 * [파인만 기법 원칙]
 * 복잡한 전문용어(GEOINT, SIGINT, MGRS, ADS-B, AIS, TLE 등) 대신,
 * 누구나 3초 안에 직관적으로 본질을 이해할 수 있는 쉬운 일상 비유와 실제 역할을 설명합니다.
 */

export interface FeynmanExplanation {
  title: string;
  category: string;
  explanation: string;
  actionHint?: string;
}

export const FEYNMAN_DICTIONARY: Record<string, FeynmanExplanation> = {
  // ── 좌측 레이어 레일 그룹 (LAYER GROUPS) ──
  'group_SDK': {
    title: '🌐 전술 SDK 데이터 망',
    category: '센서 연결 통로',
    explanation: '바다의 부표, 관측소, 해상 항로에서 보내오는 신호들을 하나로 묶어 지도에 실시간으로 띄워주는 통신 파이프라인입니다.',
    actionHint: '클릭하면 해상 전술 항로와 관측 센서 데이터를 켜고 끌 수 있습니다.',
  },
  'group_AVIATION': {
    title: '✈️ 공중 전술 항공 관제 (AVIATION)',
    category: '하늘길 실시간 레이더',
    explanation: '지금 우리 머리 위 하늘을 날고 있는 여객기, 전투기, 공중급유기, VIP 전용기의 위치와 고도, 속도를 실시간으로 추적하는 하늘길 레이더입니다.',
    actionHint: '클릭하면 일반 여객기, 전술 전투기(한·미·북), 미사일 위험 공역을 세부 선택할 수 있습니다.',
  },
  'group_MARITIME': {
    title: '🚢 해상 전술 함정 관제 (MARITIME)',
    category: '바닷길 해양 감시망',
    explanation: '서해와 동해, 전 세계 바다를 항해하는 컨테이너선, 유조선, 해군 군함과 위치 신호(AIS)를 끈 의심 선박이 어디로 가는지 배의 전파를 잡아 보여줍니다.',
    actionHint: '클릭하면 일반 상선, 군함, 불법 암흑 선박(Dark Fleet)을 구분하여 관제합니다.',
  },
  'group_SPACE': {
    title: '🛰️ 위성 및 우주 궤도 자산 (SPACE)',
    category: '우주 정찰 감시망',
    explanation: '지구 상공 수백 킬로미터 우주를 돌고 있는 스타링크 인터넷 위성, 첩보 정찰위성, GPS 항법위성, 우주정거장(ISS)이 지금 어디에 떠 있는지 궤도를 계산해 알려줍니다.',
    actionHint: '클릭하면 첩보위성, 통신위성, GPS 위성 궤도를 하나씩 켜서 볼 수 있습니다.',
  },
  'group_SURVEIL': {
    title: '📹 실시간 감시 카메라 & 영상 (SURVEILLANCE)',
    category: '지구 곳곳 실시간 눈',
    explanation: '전 세계 주요 도로, 항만, 공항에 설치된 공공 CCTV 라이브 화면과 전 세계 라디오 방송, 차량 번호판 인식기를 실시간으로 들여다보는 원격 눈입니다.',
    actionHint: '지도를 확대(Zoom 13+)하면 가장 가까운 CCTV 카메라가 영상으로 바로 팝업됩니다.',
  },
  'group_HAZARD': {
    title: '🌋 자연재해 및 위기 경보 (HAZARDS)',
    category: '재난 조기경보 시스템',
    explanation: '지구 어디선가 방금 발생한 지진의 진앙지, 인공위성이 열로 감지한 산불, 태풍과 폭설 같은 위험 기상 특보를 지도에 붉은색으로 실시간 표시합니다.',
    actionHint: '클릭하면 지진 진도, 산불 발생 지점, 기상청 특보 구역을 켜고 끌 수 있습니다.',
  },
  'group_THREAT': {
    title: '🚨 국방 안보 위협 & 대북 정보 (THREATS)',
    category: '한반도 군사 안보 레이더',
    explanation: '북한의 핵·미사일 발사 기지와 장사정포 갱도 진지, 중국의 서해 불법 구조물(선란호), 접경지역 GPS 전파 교란 신호를 실시간으로 정밀 감시합니다.',
    actionHint: '클릭하면 북한 22개 전략기지, 서해 NLL, GPS 재밍 구역을 상세 분석합니다.',
  },
  'group_NETWORK': {
    title: '🌐 인터넷 해저케이블 & 사이버 방어',
    category: '사이버 국경 감시선',
    explanation: '전 세계 대륙을 연결하는 깊은 바다 밑 해저 광케이블망과 실시간 해킹 공격, 악성코드 유포지의 위치를 지도에 투사하여 사이버 안보 상황을 봅니다.',
    actionHint: '클릭하면 해저 케이블 절단 위험 구역과 실시간 사이버 공격 경로를 확인합니다.',
  },
  'group_NETINTEL': {
    title: '📡 글로벌 통신 장애 & 정전 감시',
    category: '국가 통신망 이상 감지',
    explanation: '특정 국가나 도시의 인터넷망이 갑자기 끊기거나 대규모 디도스(DDoS) 공격이 일어났을 때, 어디서 통신 대란이 터졌는지 실시간으로 잡아냅니다.',
    actionHint: '클릭하면 전 세계 클라우드플레어 인터넷 장애 및 공격 진원지를 모니터링합니다.',
  },
  'group_DISPLAY': {
    title: '👁️ 전술 시각 모드 (3D 지형 & 명암선)',
    category: '지형 및 조명 시각화',
    explanation: '지구의 낮과 밤 경계선(태양빛 각도), 도심지의 3D 입체 건물, 산악 지형의 높낮이를 입체감 있게 지도 위에 표시합니다.',
    actionHint: '클릭하면 3D 입체 건물과 지형 elevation을 토글할 수 있습니다.',
  },
  "group_GOD'S EYE": {
    title: "🎯 신의 눈 전술 시스템 (GOD'S EYE)",
    category: '군사 광학 렌즈 필터',
    explanation: '일반 화면을 야간투시경(녹색), 열화상(FLIR 적외선), 조종석 추적 뷰, 전투기 HUD 계기판으로 바꿔 칠흑 같은 어둠 속에서도 표적을 선명하게 식별합니다.',
    actionHint: '단축키 1~7을 누르거나 필터를 골라 표적 자동 추적과 3인칭 비행 모드를 켭니다.',
  },

  // ── 좌측 레일 하단 특수 도구 ──
  'tool_style_studio': {
    title: '🎨 지도 전술 스타일 스튜디오',
    category: '지도 테마 커스텀',
    explanation: '지도의 색상 팔레트, 네온 글로우 강도, 안개 효과를 조절하여 사용자의 눈에 가장 편안하고 멋진 작전 지도로 커스터마이징합니다.',
    actionHint: '클릭하면 지도 스타일 조정 슬라이더 창이 열립니다.',
  },
  'tool_ghost': {
    title: '👻 고스트 프로토콜 (스텔스 다크 모드)',
    category: '시각 스텔스 전환',
    explanation: '화면의 불필요한 장식과 빛을 모두 끄고, 은밀한 야간 작전실처럼 흑자색 미니멀 UI로 즉시 변환하는 스텔스 테마 기능입니다.',
    actionHint: '클릭하면 고스트 다크 테마가 활성화됩니다.',
  },

  // ── 우측 세로 툴바 (RIGHT TOOL STRIP) ──
  'tool_recon': {
    title: '🔍 OSINT 정찰 레이더',
    category: '사이버 돋보기',
    explanation: '의심스러운 웹사이트 주소나 IP를 입력하면 어느 나라 서버에 숨어 있는지, 해킹 전력이 있는지 뒷배경을 순식간에 캐내는 공개정보 분석기입니다.',
    actionHint: '클릭하면 사이버 정찰 검색창이 열려 즉시 대조 분석할 수 있습니다.',
  },
  'tool_spacecam': {
    title: '🌍 우주정거장(ISS) 24시간 생중계',
    category: '실시간 우주 비디오',
    explanation: '고도 400km 우주에서 시속 27,600km로 지구를 공전하는 국제우주정거장(ISS)에 달린 고화질 카메라로 푸른 지구와 일출·일몰을 라이브로 감상합니다.',
    actionHint: '클릭하면 우주정거장의 실시간 지구 생중계 화면 팝업이 열립니다.',
  },
  'tool_markets': {
    title: '📊 글로벌 경제 & 우주 기상 지표',
    category: '안보·경제 상관관계',
    explanation: '전쟁이 터지면 요동치는 방산 주가, 원자재(원유·금), 암호화폐 시세와 인공위성 통신을 마비시키는 태양 흑점 폭발(우주 기상)을 한눈에 비교합니다.',
    actionHint: '클릭하면 글로벌 금융 시장과 지자기 폭풍 지표 패널이 열립니다.',
  },
  'tool_alerts': {
    title: '⚡ 실시간 긴급 속보 상황판',
    category: '위기 조기경보 센터',
    explanation: '방금 일어난 전 세계 지진, 분쟁 지역 교전 소식, 긴급 재난 뉴스가 실시간으로 타임라인에 업데이트되는 24시간 속보 알림판입니다.',
    actionHint: '알림 항목을 클릭하면 해당 사건이 터진 지도 위치로 카메라가 즉시 날아갑니다.',
  },
  'tool_draw': {
    title: '✏️ 전술 작전 드로잉 & 계측',
    category: '디지털 작전 지도판',
    explanation: '지도 위에 직접 작전선이나 원을 그려 위험 반경을 측정하고, 두 지점 사이의 실제 거리를 자로 재듯 정밀하게 계산하는 작전 도구입니다.',
    actionHint: '클릭하면 거리 측정, 원형 반경 그리기, 작전 구역 GeoJSON 저장 도구가 켜집니다.',
  },
  'tool_bridge': {
    title: '🌐 인텔리전스 브릿지 (비밀 서고)',
    category: '국제 안보 정보 허브',
    explanation: 'CSIS, 미 국방부(DoD) 등 6대 정보기관의 분석 보고서, 중국의 서해 침탈 시설 4단계 도판, 북한 22개 전략기지 정보를 열람하는 정보 창고입니다.',
    actionHint: '클릭하면 씽크탱크 보고서와 서해·북한 심층 분석 도판 목록이 펼쳐집니다.',
  },
  'tool_directions': {
    title: '🧭 실시간 전술 길찾기 & 내비게이션',
    category: '스마트 이동 경로 안내',
    explanation: '원하는 출발지와 목적지를 찍으면 실제 도로망과 지형을 분석하여 가장 빠르고 안전한 이동 경로와 예상 소요 시간을 단계별로 안내해 줍니다.',
    actionHint: '클릭하면 길찾기 바가 열려 주소나 지도 클릭으로 경로를 생성합니다.',
  },
  'tool_search': {
    title: '🔎 전 세계 지능 검색',
    category: '통합 지리공간 검색기',
    explanation: '도시 이름, 군사 좌표(MGRS/WGS84), 산, 공항, 항만 등 찾고 싶은 위치를 입력하면 지도 카메라가 그 장소 상공으로 부드럽게 날아갑니다.',
    actionHint: '클릭하면 고해상도 지명 및 좌표 검색창이 화면에 펼쳐집니다.',
  },
  'tool_share': {
    title: '🔗 전술 관제 뷰 공유',
    category: '상황 공유 링크 생성',
    explanation: '현재 내가 보고 있는 지도의 카메라 위치, 켜둔 레이어, 광학 센서 필터 상태를 그대로 보존하는 단축 링크를 만들어 팀원에게 보냅니다.',
    actionHint: '클릭하면 URL이 클립보드에 복사되고 소셜 공유 창이 뜹니다.',
  },
  'tool_arcgis': {
    title: '🗄️ ArcGIS 지리공간 인텔리전스',
    category: '외부 지리 데이터 임포트',
    explanation: '전 세계 지리정보시스템(ArcGIS)에서 제공하는 고정밀 군사 지도, 지질 조사선, 인프라 레이어를 내 지도 위로 직접 끌어와 겹쳐봅니다.',
    actionHint: '클릭하면 외부 레이어 검색 및 추가 창이 열립니다.',
  },
  'tool_remote': {
    title: '📶 월드 리모트 (IoT 블루투스 스캐너)',
    category: '주변 전파 스캐너',
    explanation: '내 주변 반경 수십 미터 안에 있는 블루투스 기기(TV, 스피커, 스마트 기기)의 전파를 감지해 지도상 내 위치 주변에 가상 배치합니다.',
    actionHint: '클릭하면 블루투스 장치 검색 창이 열립니다.',
  },
  'tool_shortcuts': {
    title: '⌨️ 키보드 전술 단축키',
    category: '초고속 단축키 모음',
    explanation: '마우스 없이 키보드 키 하나만으로 야간투시경을 켜고, 비행기를 쫓아가고, 지도를 회전시키는 빠른 조작키 목록을 보여줍니다.',
    actionHint: '물음표(?) 키를 누르거나 클릭하면 단축키 창이 열립니다.',
  },

  // ── 상단 액션 바 (TOP ACTION BAR) ──
  'top_nav': {
    title: '🧭 턴바이턴 내비게이션',
    category: '실시간 길찾기 바로가기',
    explanation: '목적지까지 가장 빠른 길을 찾아주는 내비게이션 창을 켜거나 끕니다. 보행, 차량 이동 경로를 실시간 시뮬레이션합니다.',
    actionHint: '클릭하면 출발지/목적지 입력 패널이 즉시 열립니다.',
  },
  'top_radio': {
    title: '📻 전술 무전 (SIGINT)',
    category: '공중·해상 전파 감청기',
    explanation: '조종사와 관제탑의 교신(LiveATC), 바다 위 배들의 무전(VHF 16번 채널), 비행기 조난 신호(Squawk 7700)를 실제 무전기 소리로 실시간 청취합니다.',
    actionHint: '클릭하면 무전 주파수 튜너와 소리 재생 패널이 열립니다.',
  },
  'top_bridge': {
    title: '🌐 인텔리전스 브릿지',
    category: '최신 첩보 브리핑',
    explanation: '국제 씽크탱크와 군사 정보기관의 최신 분석 보고서, 북한 핵기지, 서해 인공구조물 심층 자료를 팝업 메뉴로 즉시 확인합니다.',
    actionHint: '클릭하면 6대 정보기관 및 서해·북한 브리핑 드롭다운이 열립니다.',
  },
  'top_search': {
    title: '⚡ 전술 사령부 통합 검색',
    category: '초고속 표적 추적기',
    explanation: '항공기 편명(예: KAL001), 선박 이름, 도시, 위성 이름을 입력하면 지도에서 그 물체를 즉각 찾아내어 카메라를 줌인합니다.',
    actionHint: '단축키 Cmd+K 또는 클릭하여 검색어를 입력하십시오.',
  },
  'top_voice': {
    title: '🎙️ 전술 음성 AI 비서',
    category: '음성 명령 시스템',
    explanation: '마이크를 켜고 "서울 상공 비행기 보여줘", "야간투시경 켜줘"라고 말하면 AI가 말귀를 알아듣고 지도를 즉시 조작해 줍니다.',
    actionHint: '클릭하여 음성 인식을 시작하거나 단축키 V를 누르십시오.',
  },
  'top_zulu': {
    title: '⏱️ ZULU 세계 표준시 (협정 세계시 UTC)',
    category: '군사 전술 표준 시각',
    explanation: '국경과 시차가 다른 전 세계 군대와 항공기들이 작전 시간을 맞추기 위해 영국의 그리니치 자오선을 기준으로 통일한 세계 표준시(UTC)입니다.',
  },
  'top_status': {
    title: '🟢 시스템 상태: 정상 가동',
    category: '백엔드 통신 상태',
    explanation: '전 세계 레이더 수집 서버와 내 웹 브라우저 사이의 통신 파이프라인이 1밀리초의 지연 없이 생생하게 이어져 있음을 뜻합니다.',
  },
  'top_layers_count': {
    title: '📑 활성 레이어 개수',
    category: '관제 필터 현황',
    explanation: '현재 지도 위에 겹쳐서 보고 있는 데이터 계층(항공기, 선박, 위성, CCTV 등)의 총 개수입니다.',
  },
  'top_entities_count': {
    title: '🎯 실시간 추적 중인 표적 수',
    category: '실시간 관제 총량',
    explanation: '지금 이 순간 화면 안팎에서 위치 신호를 수신해 계산 중인 비행기, 군함, 인공위성 등 움직이는 실체의 총합입니다.',
  },
  'top_solar_wind': {
    title: '☀️ 우주 기상 태양풍 지수 (Kp)',
    category: '지자기 폭풍 경보',
    explanation: '태양에서 뿜어져 나오는 전자기 폭풍의 세기를 0~9등급으로 나타낸 지표로, 수치가 5 이상이면 인공위성 통신과 GPS가 먹통이 될 수 있습니다.',
  },

  // ── 하단 지도 뷰 컨트롤러 (BOTTOM MAP MODES) ──
  'view_3d': {
    title: '🏔️ 3차원 입체 지형 모드 (3D)',
    category: '실제 고도 3D 입체화',
    explanation: '평평한 지도를 백두대간과 산맥의 울퉁불퉁한 실제 높낮이가 그대로 솟아오르는 3D 입체 모형으로 바꿔주어 계곡과 능선을 한눈에 봅니다.',
    actionHint: '클릭하면 입체 지형과 3D 건물 모드가 활성화됩니다.',
  },
  'view_2d': {
    title: '🗺️ 2차원 평면 관제 모드 (2D)',
    category: '수직 직하 관제 뷰',
    explanation: '위에서 똑바로 내려다보는 평면 지도로 전환하여 왜곡 없이 전 세계의 전체적인 배치와 거리를 한눈에 직관적으로 파악합니다.',
    actionHint: '클릭하면 수직 하향 평면 뷰로 초기화됩니다.',
  },
  'view_map': {
    title: '📐 고대비 전술 벡터 지도 (MAP)',
    category: '군사 작전용 기본 지도',
    explanation: '도로망, 등고선, 국가 경계선, 주요 도시가 선명한 네온 컬러로 깔끔하게 정돈되어 표적 식별이 가장 쉬운 표준 작전 지도입니다.',
    actionHint: '클릭하면 야간 시인성이 뛰어난 다크 벡터 지도로 전환됩니다.',
  },
  'view_sat': {
    title: '🛰️ 실제 인공위성 사진 지도 (SAT)',
    category: '우주 촬영 고해상도 실사',
    explanation: '인공위성이 우주 상공에서 직접 촬영한 실제 지표면 사진으로 전환하여 공항 활주로, 항구 부두, 숲과 사막의 실제 모습을 확인합니다.',
    actionHint: '클릭하면 고해상도 위성 실사 타일 지도로 전환됩니다.',
  },

  // ── 하단 상태바 배지 (GLOBAL STATUS BAR) ──
  'status_live': {
    title: '🔴 실시간 1초 관제 가동 중 (LIVE)',
    category: '라이브 스트리밍 데이터',
    explanation: '녹화된 과거 자료가 아니라, 지금 이 순간 전 세계에서 보내오는 생생한 비행기·선박·지진 전파를 1초 단위로 실시간 수신하고 있습니다.',
  },
  'status_docs': {
    title: '📖 시스템 전술 교범 및 API (DOCS)',
    category: '공식 기술 및 운용 지침서',
    explanation: '번개의 눈동자 시스템의 전체 작동 원리, 데이터 출처, 독자적인 API 연동 규격이 정리된 상세 설명서 페이지로 이동합니다.',
    actionHint: '클릭하면 전술 교범 문서 창으로 이동합니다.',
  },
  'status_ground_truth': {
    title: '🛡️ 물리 실재성 100% 보증 게이트',
    category: 'AI 환각(거짓말) 차단막',
    explanation: '인공지능이 그럴싸하게 꾸며낸 거짓말(환각)을 완전히 걸러내고, 오직 실제 측정된 전파 신호와 관측 사실만 화면에 표시되도록 검증하는 안전장치입니다.',
  },
  'status_bridge1': {
    title: '📡 대북 군사활동 조기경보 채널',
    category: '실시간 대북 감시 피드',
    explanation: '북한의 단거리·중거리 미사일 시험 발사, 해상 NLL 침범 징후, 야간 군사 훈련 동향을 수집하여 즉시 보고하는 전문 감시망입니다.',
    actionHint: '클릭하면 최신 대북 군사활동 보고서 목록이 열립니다.',
  },
  'status_bridge2': {
    title: '🟣 풍계리 핵실험장 24시간 감시',
    category: '지진파·음파 충격파 포착',
    explanation: '자연적인 지진과 달리 땅속에서 핵폭탄이 터질 때 발생하는 인공 지진파와 공기 중 충격파를 100km 반경에서 24시간 정밀 감시합니다.',
    actionHint: '클릭하면 풍계리 핵실험 감시 보고서 목록이 열립니다.',
  },
  'status_starlink': {
    title: '🛰️ 스타링크 우주 통신망 가시 대수',
    category: '저궤도 위성 통신 중계',
    explanation: '현재 우리 상공을 지나가며 지상과 전파를 주고받을 수 있는 일론 머스크의 스타링크 위성이 몇 대나 떠 있는지 실시간으로 센 수치입니다.',
  },
  'status_btc': {
    title: '🪙 비트코인 (BTC) 실시간 시세',
    category: '글로벌 디지털 자산',
    explanation: '국제 분쟁이나 경제 위기 발생 시 국가 간 자금 이동과 시장 심리를 가장 민감하게 반영하는 글로벌 암호화폐 기준 가격입니다.',
  },
  'status_eth': {
    title: '🪙 이더리움 (ETH) 실시간 시세',
    category: '스마트 컨트랙트 기축 통화',
    explanation: '전 세계 탈중앙화 금융 네트워크의 기본 통화로, 글로벌 기술 자산의 유동성 상태를 가늠하는 지표입니다.',
  },
  'status_sol': {
    title: '🪙 솔라나 (SOL) 실시간 시세',
    category: '초고속 블록체인 통화',
    explanation: '초당 수만 건의 거래를 처리하는 고성능 블록체인 자산으로, 실시간 분산 원장 네트워크의 활성도를 나타냅니다.',
  },
  'status_quake': {
    title: '🌋 미국 지질조사국(USGS) 강진 경보',
    category: '규모 4.0 이상 지진 감시',
    explanation: '지구 지각판이 충돌해 발생한 진도 4.0 이상의 강력한 지진이 발생한 정확한 위치와 깊이, 발생 시각을 실시간으로 보여줍니다.',
  },
  'status_online': {
    title: '🟢 위성 및 레이더 통신망 정상',
    category: '글로벌 네트워크 온라인',
    explanation: '모든 데이터 스트림이 끊김 없이 정상적으로 실시간 갱신되고 있음을 나타내는 네트워크 건강 상태 신호등입니다.',
  },

  // ── 하단 단축키 바 힌트 (KEYBOARD SHORTCUT BAR) ──
  'hint_shortcuts': {
    title: '❓ 전술 단축키 도움말 (?)',
    category: '단축키: 물음표 (?)',
    explanation: '번개의 눈동자의 모든 조작키와 숨겨진 퀵 커맨드를 한눈에 확인할 수 있는 단축키 종합 치트시트를 화면에 띄웁니다.',
    actionHint: '키보드 ? 키를 누르면 단축키 카드가 열립니다.',
  },
  'hint_sensor': {
    title: '🎨 광학 센서 필터 (1-7)',
    category: '단축키: 숫자 1 ~ 7',
    explanation: '1번(일반), 2번(CRT 모니터), 3번(야간투시경), 4번(화이트 핫 열화상), 5번(아이언보우 열화상), 6번(느와르 흑백), 7번(스노우 고대비)으로 렌즈를 바꿉니다.',
    actionHint: '키보드 숫자 1부터 7을 눌러 즉시 변경할 수 있습니다.',
  },
  'hint_voice': {
    title: '🎙️ 전술 음성 AI 비서 (V)',
    category: '단축키: V',
    explanation: '음성 마이크를 켜고 "서울 상공 비행기 보여줘", "야간투시경 켜줘"라고 말하면 AI가 말귀를 알아듣고 지도를 움직여 줍니다.',
    actionHint: '키보드 V를 누르거나 우측 마이크 버튼을 클릭하십시오.',
  },
  'hint_detect': {
    title: '🎯 자동 표적 포착 락온 (D)',
    category: '단축키: D',
    explanation: '화면 안의 모든 비행기와 군함에 네모난 조준경 박스를 씌우고, 국적(아군/적군), 고도, 속도를 명찰처럼 붙여줍니다.',
    actionHint: '키보드 D를 눌러 조준경 박스를 켜거나 끕니다.',
  },
  'hint_hud': {
    title: '🛩️ 전투기 조종석 계기판 HUD (H)',
    category: '단축키: H',
    explanation: '최신 전투기 조종사가 앞 유리창을 보듯 방위각(나침반 각도), 기수 기울기(피치), 나토 군사좌표(MGRS)를 화면에 녹색 광학선으로 투사합니다.',
    actionHint: '키보드 H를 눌러 헤드업 디스플레이를 켜거나 끕니다.',
  },
  'hint_cockpit': {
    title: '✈️ 3인칭 추적 콕핏 비행 뷰 (C)',
    category: '단축키: C',
    explanation: '선택한 비행기 바로 뒤통수에 카메라를 바짝 붙여 마치 전투기 편대 비행을 하듯 비행기와 함께 하늘을 날아가는 시점을 만듭니다.',
    actionHint: '비행기 클릭 후 키보드 C를 누르면 3인칭 추적 모드가 시작됩니다.',
  },
  'hint_contacts': {
    title: '📻 반경 250km 표적 레이더판 (T)',
    category: '단축키: T',
    explanation: '지금 내 화면 중심으로부터 반경 250km 안에 있는 모든 비행기, 배, 위성을 가장 가까운 순서대로 나열하여 거리를 계산해 줍니다.',
    actionHint: '키보드 T를 눌러 근접 표적 명단을 엽니다.',
  },

  // ── 우측 하단 플로팅 AI 참모 ──
  'tool_ai_studio': {
    title: '🤖 로컬 AI 전술 지능 참모',
    category: '온디바이스 인공지능',
    explanation: '내 컴퓨터 안에서 안전하게 돌아가는 보안 AI가 서해 중국 침탈 시설, 북한 미사일 분석에 대해 실시간 전술 브리핑을 음성으로 들려줍니다.',
    actionHint: '클릭하면 로컬 AI 전술 스튜디오 창이 열립니다.',
  },
};

/**
 * 키에 해당하는 파인만 해설을 안전하게 가져옵니다.
 */
export function getFeynmanExplanation(key: string, fallbackTitle?: string): FeynmanExplanation {
  if (FEYNMAN_DICTIONARY[key]) {
    return FEYNMAN_DICTIONARY[key];
  }
  return {
    title: fallbackTitle || key,
    category: '파인만 직관 해설',
    explanation: `${fallbackTitle || key} 기능입니다. 클릭하여 전술 데이터를 확인하거나 조작할 수 있습니다.`,
    actionHint: '클릭하여 상태를 전환하십시오.',
  };
}
