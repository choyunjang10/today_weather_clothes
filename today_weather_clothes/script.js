/**
 * 오날입 — script.js
 * 날씨 기반 옷차림 추천 로직
 * API: Open-Meteo (무료, 키 불필요) + Nominatim (역지오코딩)
 */

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

// ── WMO 날씨 코드 해석 ────────────────────────────────
// Open-Meteo uses WMO Weather interpretation codes
const WMO = {
  0:  { desc: '맑음',          emoji: '☀️',  type: 'clear' },
  1:  { desc: '대체로 맑음',   emoji: '🌤',  type: 'clear' },
  2:  { desc: '구름 조금',     emoji: '⛅️',  type: 'cloudy' },
  3:  { desc: '흐림',          emoji: '☁️',  type: 'cloudy' },
  45: { desc: '안개',          emoji: '🌫',  type: 'fog' },
  48: { desc: '안개',          emoji: '🌫',  type: 'fog' },
  51: { desc: '이슬비',        emoji: '🌦',  type: 'drizzle' },
  53: { desc: '이슬비',        emoji: '🌦',  type: 'drizzle' },
  55: { desc: '이슬비',        emoji: '🌧',  type: 'drizzle' },
  61: { desc: '비',            emoji: '🌧',  type: 'rain' },
  63: { desc: '비',            emoji: '🌧',  type: 'rain' },
  65: { desc: '강한 비',       emoji: '🌧',  type: 'rain' },
  71: { desc: '눈',            emoji: '🌨',  type: 'snow' },
  73: { desc: '눈',            emoji: '❄️',  type: 'snow' },
  75: { desc: '강한 눈',       emoji: '❄️',  type: 'snow' },
  77: { desc: '우박',          emoji: '🌨',  type: 'snow' },
  80: { desc: '소나기',        emoji: '🌦',  type: 'rain' },
  81: { desc: '소나기',        emoji: '🌧',  type: 'rain' },
  82: { desc: '강한 소나기',   emoji: '⛈',  type: 'rain' },
  85: { desc: '눈 소나기',     emoji: '🌨',  type: 'snow' },
  86: { desc: '강한 눈 소나기',emoji: '❄️',  type: 'snow' },
  95: { desc: '천둥번개',      emoji: '⛈',  type: 'thunder' },
  96: { desc: '뇌우',          emoji: '⛈',  type: 'thunder' },
  99: { desc: '강한 뇌우',     emoji: '⛈',  type: 'thunder' },
};

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
  const wmo = WMO[data.weatherCode] || { desc: '날씨 정보 없음', emoji: '🌡', type: 'clear' };
  weatherEmoji.textContent = wmo.emoji;
  weatherDesc.textContent = wmo.desc;
  humidity.textContent = `${data.humidity}%`;
  windSpeed.textContent = `${data.wind} m/s`;
  tempMain.textContent = displayTemp(data.temp);
  tempFeel.textContent = displayTemp(data.feels_like);

  // 코디 추천
  const outfit = getOutfitRecommendation(data.temp, wmo.type);
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

// ── Open-Meteo API ────────────────────────────────────
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&wind_speed_unit=ms&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('날씨 데이터를 가져올 수 없습니다.');
  const json = await res.json();
  const c = json.current;
  return {
    temp:        c.temperature_2m,
    feels_like:  c.apparent_temperature,
    humidity:    c.relative_humidity_2m,
    wind:        Math.round(c.wind_speed_10m * 10) / 10,
    weatherCode: c.weather_code,
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
