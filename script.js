/**
 * 오날입 — script.js
 * 날씨 기반 옷차림 추천 로직
 * API: 기상청 단기예보 (공공데이터포털) + Nominatim (역지오코딩)
 */

// ── 기상청 API 설정 ────────────────────────────────────
const KMA_API_KEY = '284fbaf80e75d311df67dccdc7e8d7a42b0502a9d496733ed46ffb17898d4913';
const KMA_BASE_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';

// ── 날씨별 배경음악 (Internet Archive / CC0 무료 음원) ───────
// 모두 Creative Commons / Public Domain 라이선스
const MUSIC_MAP = {
  clear: {
    // 맑음 — 밝고 따뜻한 lofi 재즈
    url: 'https://archive.org/download/kalaido-hanging-lanterns_202101/%28no%20copyright%20music%29%20jazz%20type%20beat%20bread%20royalty%20free%20youtube%20music%20prod.%20by%20lukrembo.mp3',
    label: '☀️ Sunny Lofi Jazz',
  },
  cloudy: {
    // 흐림 — 차분하고 몽환적인 ambient
    url: 'https://archive.org/download/kalaido-hanging-lanterns_202101/%5BNon%20Copyrighted%20Music%5D%20Artificial.Music%20-%20Herbal%20Tea%20%5BLo-fi%5D.mp3',
    label: '⛅ Cloudy Lofi Chill',
  },
  rain: {
    // 비 — 잔잔한 lofi hip-hop
    url: 'https://archive.org/download/kalaido-hanging-lanterns_202101/%5BNo%20Copyright%20Music%5D%20Chill%20Jazzy%20Lofi%20Hip-Hop%20Beat%20%28Copyright%20Free%29%20Music%20By%20KaizanBlu.mp3',
    label: '🌧 Rainy Lofi Hip-Hop',
  },
  snow: {
    // 눈 — 조용하고 따뜻한 ambient lofi
    url: 'https://archive.org/download/kalaido-hanging-lanterns_202101/finite%20-%20Lofi%20Hip%20Hop%20Beat%20%28FREE%20FOR%20PROFIT%20USE%29.mp3',
    label: '❄️ Snowy Ambient Lofi',
  },
};

// ── 음악 플레이어 상태 ────────────────────────────────────
let audioPlayer = null;
let currentMusicType = null;
let musicEnabled = true; // 사용자가 끄기 전까지 자동재생 시도

function initAudio(weatherType) {
  const music = MUSIC_MAP[weatherType] || MUSIC_MAP.clear;
  if (currentMusicType === weatherType && audioPlayer) return; // 이미 재생 중

  // 기존 플레이어 정리
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }

  currentMusicType = weatherType;
  audioPlayer = new Audio(music.url);
  audioPlayer.loop = true;
  audioPlayer.volume = 0.35;

  // 음악 버튼 라벨 업데이트
  updateMusicBtn(music.label);

  if (musicEnabled) {
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setMusicBtnState(true);
        })
        .catch(() => {
          // 브라우저 자동재생 정책에 막힌 경우 → 버튼으로 유도
          setMusicBtnState(false);
          showMusicHint();
        });
    }
  }
}

function updateMusicBtn(label) {
  const btn = document.getElementById('musicToggleBtn');
  if (btn) btn.dataset.label = label;
}

function setMusicBtnState(isPlaying) {
  const btn = document.getElementById('musicToggleBtn');
  if (!btn) return;
  btn.textContent = isPlaying ? '🔊' : '🔇';
  btn.title = isPlaying ? '음악 끄기' : '음악 켜기';
  btn.classList.toggle('music-off', !isPlaying);
}

function showMusicHint() {
  const hint = document.getElementById('musicHint');
  if (hint) {
    hint.classList.remove('hidden');
    setTimeout(() => hint.classList.add('hidden'), 4000);
  }
}

function toggleMusic() {
  if (!audioPlayer) return;
  if (audioPlayer.paused) {
    audioPlayer.play().then(() => setMusicBtnState(true)).catch(() => {});
    musicEnabled = true;
  } else {
    audioPlayer.pause();
    setMusicBtnState(false);
    musicEnabled = false;
  }
}

// ── 상태 ──────────────────────────────────────────────
let isCelsius = true;
let currentTemp = null; // 항상 섭씨로 저장

// ── DOM ───────────────────────────────────────────────
const loadingState   = document.getElementById('loadingState');
const errorState     = document.getElementById('errorState');
const mainContent    = document.getElementById('mainContent');
const footerSection  = document.getElementById('footerSection');
const errorMessage   = document.getElementById('errorMessage');

const locationName   = document.getElementById('locationName');
const dateWrap       = document.getElementById('dateWrap');
const weatherEmoji   = document.getElementById('weatherEmoji');
const tempMain       = document.getElementById('tempMain');
const tempFeel       = document.getElementById('tempFeel');
const weatherDesc    = document.getElementById('weatherDesc');
const humidity       = document.getElementById('humidity');
const windSpeed      = document.getElementById('windSpeed');

const outfitMessage  = document.getElementById('outfitMessage');
const outfitTopIcon  = document.getElementById('outfitTopIcon');
const outfitTopVal   = document.getElementById('outfitTopVal');
const outfitBottomIcon = document.getElementById('outfitBottomIcon');
const outfitBottomVal  = document.getElementById('outfitBottomVal');
const outfitShoesIcon  = document.getElementById('outfitShoesIcon');
const outfitShoesVal   = document.getElementById('outfitShoesVal');
const outfitExtraWrap  = document.getElementById('outfitExtraWrap');
const outfitExtraIcon  = document.getElementById('outfitExtraIcon');
const outfitExtraVal   = document.getElementById('outfitExtraVal');
const footerReason   = document.getElementById('footerReason');

const unitToggle     = document.getElementById('unitToggle');
const themeToggle    = document.getElementById('themeToggle');

// ── 기상청 PTY(강수형태) + SKY(하늘상태) 코드 해석 ──────
// PTY: 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기
// SKY: 1=맑음, 3=구름많음, 4=흐림
function parseKMAWeather(pty, sky) {
  if (pty === 1) return { desc: '비',       emoji: '🌧', type: 'rain' };
  if (pty === 2) return { desc: '비/눈',    emoji: '🌨', type: 'snow' };
  if (pty === 3) return { desc: '눈',       emoji: '❄️', type: 'snow' };
  if (pty === 4) return { desc: '소나기',   emoji: '🌦', type: 'rain' };
  // 강수 없을 때 하늘 상태
  if (sky === 1) return { desc: '맑음',     emoji: '☀️', type: 'clear' };
  if (sky === 3) return { desc: '구름많음', emoji: '⛅️', type: 'cloudy' };
  if (sky === 4) return { desc: '흐림',     emoji: '☁️', type: 'cloudy' };
  return { desc: '맑음', emoji: '🌤', type: 'clear' };
}

// ── 옷 추천 로직 ──────────────────────────────────────
function getOutfitRecommendation(tempC, weatherType) {
  let top, topIcon, bottom, bottomIcon, shoes, shoesIcon;
  let extra = null, extraIcon = null;
  let message, reason;

  // 온도 기반 베이스 추천
  if (tempC >= 28) {
    top = '민소매 / 반팔 티셔츠';   topIcon = '👕';
    bottom = '반바지 / 숏팬츠';      bottomIcon = '🩳';
    shoes = '샌들 / 슬리퍼';         shoesIcon = '🩴';
    message = `오늘은 ${Math.round(tempC)}도의 무더운 날씨예요. 최대한 가볍고 시원하게 입는 것이 좋아요.`;
    reason = '기온이 매우 높아 통기성 좋은 소재와 짧은 의류를 착용하면 열사병 예방에 도움이 됩니다.';
  } else if (tempC >= 23) {
    top = '반팔 티셔츠';              topIcon = '👕';
    bottom = '면 반바지 / 얇은 바지'; bottomIcon = '👖';
    shoes = '운동화 / 샌들';          shoesIcon = '👟';
    message = `오늘은 ${Math.round(tempC)}도의 따뜻한 날씨예요. 가볍고 편한 여름 스타일을 추천해요.`;
    reason = '따뜻한 날씨로 가벼운 여름 의류가 적합합니다. 자외선 차단에도 신경 써주세요.';
  } else if (tempC >= 18) {
    top = '긴팔 티셔츠 / 얇은 셔츠';  topIcon = '👔';
    bottom = '청바지 / 면 긴바지';     bottomIcon = '👖';
    shoes = '운동화';                   shoesIcon = '👟';
    message = `오늘은 ${Math.round(tempC)}도의 선선한 날씨예요. 긴팔에 얇은 바지면 딱 좋아요.`;
    reason = '낮에는 따뜻하고 아침저녁으로 쌀쌀할 수 있으니 긴팔을 챙겨두는 것이 좋습니다.';
  } else if (tempC >= 12) {
    top = '맨투맨 / 니트';             topIcon = '🧥';
    bottom = '청바지 / 슬랙스';        bottomIcon = '👖';
    shoes = '운동화 / 로퍼';           shoesIcon = '👟';
    message = `오늘은 ${Math.round(tempC)}도의 쌀쌀한 날씨예요. 니트나 맨투맨으로 포근하게 입어요.`;
    reason = '봄/가을 기온으로 한 겹 덧입을 수 있는 아우터나 두꺼운 상의가 필요합니다.';
  } else if (tempC >= 5) {
    top = '두꺼운 니트 / 자켓';        topIcon = '🧥';
    bottom = '두꺼운 청바지 / 기모 바지'; bottomIcon = '👖';
    shoes = '운동화 / 첼시부츠';       shoesIcon = '🥾';
    message = `오늘은 ${Math.round(tempC)}도의 꽤 추운 날씨예요. 자켓을 꼭 챙기세요.`;
    reason = '기온이 낮아 레이어링(겹쳐입기)이 중요합니다. 내복 착용도 고려해보세요.';
  } else if (tempC >= 0) {
    top = '패딩 / 두꺼운 코트';        topIcon = '🧥';
    bottom = '기모 바지 / 두꺼운 청바지'; bottomIcon = '👖';
    shoes = '부츠 / 방한화';           shoesIcon = '🥾';
    message = `오늘은 ${Math.round(tempC)}도의 추운 날씨예요. 패딩이나 두꺼운 코트는 필수예요.`;
    reason = '추운 날씨에 체온 유지가 중요합니다. 목도리와 장갑도 챙기면 좋아요.';
  } else {
    top = '두꺼운 패딩 / 롱패딩';      topIcon = '🧥';
    bottom = '기모 두꺼운 바지 / 방한 레깅스'; bottomIcon = '👖';
    shoes = '방한 부츠';               shoesIcon = '🥾';
    message = `오늘은 ${Math.round(tempC)}도의 영하 날씨예요! 두꺼운 패딩은 필수이고, 보온에 최대한 신경 쓰세요.`;
    reason = '영하의 기온으로 방한 필수입니다. 손발 보온을 위해 장갑, 목도리, 모자를 착용하세요.';
  }

  // 날씨 상태 오버라이드
  if (weatherType === 'snow') {
    shoes = '방한 부츠 (미끄럼 주의)'; shoesIcon = '🥾';
    extra = '방수 장갑 / 목도리'; extraIcon = '🧤';
    message = `오늘은 눈이 내리고 기온이 ${Math.round(tempC)}도예요. 방한과 미끄럼 방지에 유의하세요.`;
    reason += ' 눈이 내려 미끄럼 방지 밑창의 부츠 착용을 강력히 추천합니다.';
  } else if (weatherType === 'rain' || weatherType === 'drizzle') {
    if (tempC > 12) {
      shoes = '방수 운동화 / 장화'; shoesIcon = '🧤';
    } else {
      shoes = '방수 부츠 / 장화'; shoesIcon = '🥾';
    }
    extra = '우산 (필수!)'; extraIcon = '☂️';
    message = `오늘은 비가 오고 기온이 ${Math.round(tempC)}도예요. 우산과 방수 신발을 꼭 챙기세요.`;
    reason += ' 비로 인해 방수 소재 신발과 우산 지참이 필수입니다.';
  } else if (weatherType === 'thunder') {
    extra = '우산 (뇌우 주의)'; extraIcon = '⛈';
    message = `오늘은 천둥번개가 예보된 기온 ${Math.round(tempC)}도예요. 실내에 머물거나 외출 시 우산을 챙기세요.`;
    reason += ' 뇌우가 예상되어 외출에 특별한 주의가 필요합니다.';
  }

  return { top, topIcon, bottom, bottomIcon, shoes, shoesIcon, extra, extraIcon, message, reason };
}

// ── 온도 표시 헬퍼 ────────────────────────────────────
function displayTemp(tempC) {
  if (isCelsius) return `${Math.round(tempC)}°C`;
  return `${Math.round(tempC * 9 / 5 + 32)}°F`;
}

// ── UI 업데이트 ───────────────────────────────────────
function updateTempDisplay() {
  if (currentTemp === null) return;
  // appWeatherData가 있을 때만 업데이트
  if (window._weatherData) {
    const d = window._weatherData;
    tempMain.textContent = displayTemp(d.temp);
    tempFeel.textContent = displayTemp(d.feels_like);
  }
  unitToggle.textContent = isCelsius ? '°C' : '°F';
}

function renderWeather(data) {
  window._weatherData = data;
  currentTemp = data.temp;

  // 날짜
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  dateWrap.innerHTML = `${dateStr}<br/>${timeStr} 기준`;

  // 날씨 기본 정보
  const weather = parseKMAWeather(data.pty, data.sky);
  weatherEmoji.textContent = weather.emoji;
  weatherDesc.textContent = weather.desc;
  humidity.textContent = `${data.humidity}%`;
  windSpeed.textContent = `${data.wind} m/s`;
  tempMain.textContent = displayTemp(data.temp);
  tempFeel.textContent = displayTemp(data.feels_like);

  // 코디 추천
  const outfit = getOutfitRecommendation(data.temp, weather.type);
  outfitMessage.textContent = outfit.message;
  outfitTopIcon.textContent = outfit.topIcon;
  outfitTopVal.textContent = outfit.top;
  outfitBottomIcon.textContent = outfit.bottomIcon;
  outfitBottomVal.textContent = outfit.bottom;
  outfitShoesIcon.textContent = outfit.shoesIcon;
  outfitShoesVal.textContent = outfit.shoes;

  if (outfit.extra) {
    outfitExtraWrap.style.display = '';
    outfitExtraIcon.textContent = outfit.extraIcon;
    outfitExtraVal.textContent = outfit.extra;
  } else {
    outfitExtraWrap.style.display = 'none';
  }

  footerReason.textContent = outfit.reason;

  // 배경음악 재생
  initAudio(weather.type);

  // 화면 전환
  loadingState.classList.add('hidden');
  mainContent.classList.remove('hidden');
  footerSection.classList.remove('hidden');
}

// ── 역지오코딩 (Nominatim) ────────────────────────────
async function getLocationName(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { 'User-Agent': 'OnalipWeatherApp/1.0' } }
    );
    const data = await res.json();
    const addr = data.address;
    // 행정 단위 우선순위
    return (
      addr.city || addr.town || addr.county ||
      addr.state_district || addr.state || addr.country || '현재 위치'
    );
  } catch {
    return '현재 위치';
  }
}

// ── 위도/경도 → 기상청 격자 좌표 변환 ────────────────────
// 기상청 공식 변환 알고리즘 (Lambert Conformal Conic)
function latLonToGrid(lat, lon) {
  const RE = 6371.00877;   // 지구 반경 (km)
  const GRID = 5.0;        // 격자 간격 (km)
  const SLAT1 = 30.0;      // 표준위도 1
  const SLAT2 = 60.0;      // 표준위도 2
  const OLON = 126.0;      // 기준점 경도
  const OLAT = 38.0;       // 기준점 위도
  const XO = 43;           // 기준점 X 격자
  const YO = 136;          // 기준점 Y 격자

  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon  = OLON  * DEGRAD;
  const olat  = OLAT  * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);

  const ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  const r  = re * sf / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI)  theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    x: Math.floor(r * Math.sin(theta) + XO + 0.5),
    y: Math.floor(ro - r * Math.cos(theta) + YO + 0.5),
  };
}

// ── 기상청 발표시각 계산 ──────────────────────────────────
// 초단기실황은 매 정시 발표, 약 10분 후 제공
function getBaseDateTime() {
  const now = new Date();
  // 현재 시각에서 10분 전으로 안전마진 적용
  now.setMinutes(now.getMinutes() - 10);

  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const hh   = String(now.getHours()).padStart(2, '0');

  return {
    baseDate: `${yyyy}${mm}${dd}`,
    baseTime: `${hh}00`,
  };
}

// ── 기상청 초단기실황 API ─────────────────────────────────
async function fetchWeather(lat, lon) {
  const { x, y } = latLonToGrid(lat, lon);
  const { baseDate, baseTime } = getBaseDateTime();

  const params = new URLSearchParams({
    serviceKey: KMA_API_KEY,
    pageNo: '1',
    numOfRows: '10',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: x,
    ny: y,
  });

  const res = await fetch(`${KMA_BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`기상청 API 오류: ${res.status}`);

  const json = await res.json();
  const header = json?.response?.header;
  if (header?.resultCode !== '00') {
    throw new Error(`기상청 응답 오류: ${header?.resultMsg || '알 수 없는 오류'}`);
  }

  const items = json.response.body.items.item;

  // 카테고리별 값 추출
  const get = (cat) => {
    const item = items.find(i => i.category === cat);
    return item ? parseFloat(item.obsrValue) : null;
  };

  const T1H  = get('T1H');   // 기온 (°C)
  const REH  = get('REH');   // 습도 (%)
  const WSD  = get('WSD');   // 풍속 (m/s)
  const PTY  = get('PTY');   // 강수형태 (0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기)
  const SKY  = get('SKY');   // 하늘상태 (1=맑음, 3=구름많음, 4=흐림) — 초단기실황 미제공 시 null
  const RN1  = get('RN1');   // 1시간 강수량

  // 체감온도: 풍속이 있을 때 바람냉각지수 적용 (간이 계산)
  let feelsLike = T1H;
  if (T1H !== null && WSD !== null) {
    if (T1H <= 10 && WSD >= 1.3) {
      // 바람 냉각 지수 (Wind Chill)
      feelsLike = 13.12 + 0.6215 * T1H - 11.37 * Math.pow(WSD * 3.6, 0.16) + 0.3965 * T1H * Math.pow(WSD * 3.6, 0.16);
      feelsLike = Math.round(feelsLike * 10) / 10;
    } else if (T1H >= 27 && REH !== null) {
      // 열지수 (Heat Index) 간이 계산
      feelsLike = -8.78469475556 + 1.61139411 * T1H + 2.3385472 * REH
        - 0.14611605 * T1H * REH - 0.012308094 * T1H * T1H
        - 0.016424828 * REH * REH + 0.002211732 * T1H * T1H * REH
        + 0.00072546 * T1H * REH * REH - 0.000003582 * T1H * T1H * REH * REH;
      feelsLike = Math.round(feelsLike * 10) / 10;
    }
  }

  return {
    temp:       T1H ?? 0,
    feels_like: feelsLike ?? T1H ?? 0,
    humidity:   REH ?? 0,
    wind:       WSD !== null ? Math.round(WSD * 10) / 10 : 0,
    pty:        PTY ?? 0,
    sky:        SKY ?? 1,
    rn1:        RN1,
  };
}

// ── 위치 가져오기 ─────────────────────────────────────
function showError(msg) {
  loadingState.classList.add('hidden');
  errorState.classList.remove('hidden');
  errorMessage.textContent = msg;
}

async function init() {
  if (!navigator.geolocation) {
    showError('이 브라우저는 위치 서비스를 지원하지 않습니다.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        const [name, weather] = await Promise.all([
          getLocationName(lat, lon),
          fetchWeather(lat, lon),
        ]);
        locationName.textContent = name;
        renderWeather(weather);
      } catch (e) {
        showError('날씨 정보를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        console.error(e);
      }
    },
    (err) => {
      switch (err.code) {
        case 1:
          showError('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.');
          break;
        case 2:
          showError('위치 정보를 가져올 수 없습니다. 네트워크 연결을 확인해주세요.');
          break;
        case 3:
          showError('위치 정보 요청이 시간 초과되었습니다. 다시 시도해주세요.');
          break;
        default:
          showError('알 수 없는 오류가 발생했습니다.');
      }
    },
    { timeout: 12000, maximumAge: 300000, enableHighAccuracy: false }
  );
}

// ── 이벤트 리스너 ─────────────────────────────────────

// 음악 토글 버튼
const musicToggleBtn = document.getElementById('musicToggleBtn');
if (musicToggleBtn) musicToggleBtn.addEventListener('click', toggleMusic);

// 온도 단위 전환
unitToggle.addEventListener('click', () => {
  isCelsius = !isCelsius;
  updateTempDisplay();
});

// 다크/라이트 모드 전환
themeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  themeToggle.textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('onalip-theme', isDark ? 'light' : 'dark');
});

// 저장된 테마 복원
(function restoreTheme() {
  const saved = localStorage.getItem('onalip-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    themeToggle.textContent = saved === 'dark' ? '☀️' : '🌙';
  }
})();

// ── 실행 ─────────────────────────────────────────────
init();
