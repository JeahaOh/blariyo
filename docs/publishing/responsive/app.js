const homePosts = [
  [1048, '회의 시작 5분 전에 모두가 갑자기 바빠지는 이유', 812, '14:30'],
  [1047, '퇴근 직전에 질문 하나만 하겠다는 사람의 진짜 의미', 1248, '14:05'],
  [1046, '간식을 숨긴 위치를 정확히 기억하고 있던 고양이', 967, '13:30'],
  [1045, '배달 메뉴를 20분 보고 결국 냉장고를 연 사람', 704, '13:05'],
  [1044, '온라인 후기에서 별점보다 먼저 봐야 하는 문장', 533, '12:30'],
  [1043, '분명 하나만 사러 갔는데 계산대에서 만난 장바구니', 411, '12:05'],
  [1042, '팀장님이 잠깐 보자고 했을 때 머릿속에 스치는 생각', 388, '11:30'],
  [1041, '엘리베이터 닫힘 버튼을 누른 사람들의 조용한 연대', 351, '11:05'],
  [1040, '비 오는 날 우산을 챙긴 사람이 가장 먼저 하는 말', 320, '10:30'],
  [1039, '월요일 아침 컴퓨터 업데이트가 알려준 삶의 진실', 297, '10:05'],
  [1038, '카페에서 콘센트 자리를 발견했을 때의 표정 관리', 266, '09:30'],
  [1037, '택배 도착 알림 하나로 하루가 살아나는 순간', 244, '09:05'],
  [1036, '회의록을 쓰다 보면 갑자기 기억력이 좋아지는 이유', 231, '08:30'],
  [1035, '점심 메뉴 정하기가 프로젝트보다 어려운 이유', 219, '08:05'],
  [1034, '충전기 빌려달라는 말에 사무실이 조용해지는 순간', 201, '8월 11일'],
  [1033, '분명 쉬러 갔는데 더 피곤해져서 돌아온 주말', 188, '8월 11일'],
  [1032, '고양이가 모니터 앞에 앉는 정확한 타이밍', 173, '8월 11일'],
  [1031, '냉장고 문을 열고 뭘 찾는지 잊어버린 사람', 160, '8월 11일'],
  [1030, '출근길 이어폰 배터리 3퍼센트가 주는 긴장감', 142, '8월 11일'],
  [1029, '알람을 끄고 눈을 감은 5분의 위험성', 128, '8월 11일']
].map(([no, title, views, time]) => ({ no, title, views, time }));

const pinnedNotices = [
  { no: 12, title: '블라리요 운영 및 권리자 요청 안내', views: 1842, time: '8월 12일' },
  { no: 11, title: '광고·제휴 콘텐츠 표시 기준 안내', views: 936, time: '8월 12일' }
].slice(0, 3);

const detailPosts = Array.from({ length: 20 }, (_, index) => {
  const no = 1056 - index;
  const sample = homePosts.find((post) => post.no === no);
  return sample || {
    no,
    title: `퇴근길에 발견한 오늘의 짤 ${no}`,
    views: 760 - index * 21,
    time: index < 10 ? `${String(14 - index).padStart(2, '0')}:20` : '8월 11일'
  };
});

const currentPostNo = 1047;
const screens = Array.from(document.querySelectorAll('[data-view]'));
const screenTabs = Array.from(document.querySelectorAll('[data-screen]'));
const shareButton = document.getElementById('shareButton');
const shareMenu = document.getElementById('shareMenu');
const shareStatus = document.getElementById('shareStatus');
const backToList = document.getElementById('backToList');
const leftSpacer = document.getElementById('leftSpacer');
const loginLink = document.getElementById('loginLink');
const adblockModal = document.getElementById('adblockModal');
const adblockDialog = adblockModal.querySelector('[role="dialog"]');
const adblockGuide = document.getElementById('adblockGuide');
const policyModal = document.getElementById('policyModal');
const policyDialog = policyModal.querySelector('[role="dialog"]');
const policyTitle = document.getElementById('policyTitle');
const policyDescription = document.getElementById('policyDescription');
const policyContent = document.getElementById('policyContent');
const cookieBanner = document.getElementById('cookieBanner');
const cookieConsentKey = 'blariyo_consent';
const modalBackground = [
  document.querySelector('.review-toolbar'),
  document.querySelector('.site-header'),
  document.querySelector('.site-shell'),
  document.querySelector('.site-footer'),
  cookieBanner
];
let adblockDismissed = sessionStorage.getItem('blariyo.adblockNoticeDismissed') === '1';
let modalReturnFocus = null;
let currentPolicy = null;

function readCookieConsent() {
  try {
    const saved = JSON.parse(localStorage.getItem(cookieConsentKey));
    return saved?.version === 1 ? saved : null;
  } catch {
    return null;
  }
}

let cookieConsent = readCookieConsent();

function saveCookieConsent({ analytics, ads }) {
  cookieConsent = { version: 1, analytics: Boolean(analytics), ads: Boolean(ads), savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(cookieConsentKey, JSON.stringify(cookieConsent));
  } catch {
    // 저장소가 막혀도 현재 화면에서는 선택을 반영한다.
  }
  cookieBanner.hidden = true;
}

const policyHistory = {
  terms: {
    title: '이용약관',
    description: '현재 적용 문서 전체를 먼저 읽고 하단에서 개정 이력을 선택합니다.',
    version: 'v0.1',
    subject: '블라리요 이용약관 초안',
    date: '시행 전',
    status: '현재 초안'
  },
  privacy: {
    title: '개인정보처리방침',
    description: '현재 적용 문서 전체를 먼저 읽고 하단에서 개정 이력을 선택합니다.',
    version: 'v0.1',
    subject: '블라리요 개인정보처리방침 초안',
    date: '시행 전',
    status: '현재 초안'
  }
};

function createPostRow(post, { current = false } = {}) {
  const row = document.createElement(current ? 'div' : 'a');
  row.className = `post-row${current ? ' is-current' : ''}`;

  if (current) {
    row.setAttribute('aria-current', 'true');
    row.setAttribute('aria-disabled', 'true');
  } else {
    row.href = `/posts/${post.no}`;
    row.dataset.go = 'detail';
  }

  row.innerHTML = `
    <span class="post-title">${post.title}${current ? '<small class="current-badge">현재 글</small>' : ''}</span>
    <span class="post-meta"><span class="operator">운영자</span><span>No.${post.no}</span><span>${post.time}</span><span>조회 ${post.views.toLocaleString('ko-KR')}</span></span>
  `;
  return row;
}

function createNoticeRow(notice) {
  const row = document.createElement('a');
  row.className = 'post-row notice-row';
  row.href = `/posts/${notice.no}`;
  row.dataset.go = 'detail';
  row.innerHTML = `
    <span class="notice-line"><strong class="notice-badge">공지</strong><span class="post-title">${notice.title}</span></span>
    <span class="post-meta"><span class="operator">운영자</span><span>No.${notice.no}</span><span>${notice.time}</span><span>조회 ${notice.views.toLocaleString('ko-KR')}</span></span>
  `;
  return row;
}

function createAdRow(label) {
  const ad = document.createElement('div');
  ad.className = 'ad-row';
  ad.setAttribute('role', 'complementary');
  ad.setAttribute('aria-label', '광고');
  const title = document.createElement('strong');
  title.textContent = label;
  ad.appendChild(title);
  return ad;
}

function renderRows(target, posts, { adAfterIndex, adLabel, markCurrent = false, notices = [] }) {
  const container = document.querySelector(target);
  if (!container) return;
  container.replaceChildren();
  notices.slice(0, 3).forEach((notice) => container.appendChild(createNoticeRow(notice)));
  posts.forEach((post, index) => {
    container.appendChild(createPostRow(post, { current: markCurrent && post.no === currentPostNo }));
    if (index === adAfterIndex) container.appendChild(createAdRow(adLabel));
  });
}

function updateHeader(name) {
  const isDetail = name === 'detail';
  backToList.hidden = !isDetail;
  shareButton.hidden = !isDetail;
  leftSpacer.hidden = isDetail;
  loginLink.hidden = isDetail;
}

function showScreen(name, { focus = false } = {}) {
  const next = screens.find((screen) => screen.dataset.view === name);
  if (!next) return;

  screens.forEach((screen) => {
    const active = screen === next;
    screen.classList.toggle('is-active', active);
    screen.hidden = !active;
  });
  screenTabs.forEach((tab) => {
    const active = tab.dataset.screen === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  updateHeader(name);
  history.replaceState(null, '', `#${name}`);
  window.scrollTo({ top: 0, behavior: 'auto' });
  closeShareMenu(false);
  if (focus) (next.querySelector('h1') || next).focus({ preventScroll: true });
  if (name === 'detail' && !adblockDismissed) openAdblockModal();
}

function openShareMenu() {
  shareMenu.hidden = false;
  shareButton.setAttribute('aria-expanded', 'true');
  positionShareMenu();
  shareMenu.querySelector('.share-options button').focus();
}

function positionShareMenu() {
  if (window.matchMedia('(max-width: 767px)').matches) {
    shareMenu.style.top = '';
    shareMenu.style.right = '';
    return;
  }
  const trigger = shareButton.getBoundingClientRect();
  shareMenu.style.top = `${trigger.bottom + 8}px`;
  shareMenu.style.right = `${Math.max(14, window.innerWidth - trigger.right)}px`;
}

function closeShareMenu(restoreFocus = true) {
  if (!shareMenu || shareMenu.hidden) return;
  shareMenu.hidden = true;
  shareButton.setAttribute('aria-expanded', 'false');
  if (restoreFocus && !shareButton.hidden) shareButton.focus();
}

function openAdblockModal() {
  modalReturnFocus = document.activeElement;
  closeShareMenu(false);
  adblockModal.hidden = false;
  document.body.classList.add('modal-open');
  modalBackground.forEach((element) => { element.inert = true; });
  adblockDialog.focus();
}

function closeAdblockModal({ remember = true } = {}) {
  if (adblockModal.hidden) return;
  adblockModal.hidden = true;
  document.body.classList.remove('modal-open');
  modalBackground.forEach((element) => { element.inert = false; });
  if (remember) {
    adblockDismissed = true;
    sessionStorage.setItem('blariyo.adblockNoticeDismissed', '1');
  }
  if (modalReturnFocus instanceof HTMLElement) modalReturnFocus.focus();
}

function trapModalFocus(dialog, event) {
  const focusable = Array.from(dialog.querySelectorAll('button:not([hidden]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function policyHistoryMarkup(type) {
  const policy = policyHistory[type];
  return `
    <section class="policy-history-section" aria-labelledby="${type}HistoryTitle">
      <h3 id="${type}HistoryTitle">개정 이력</h3>
      <p>버전을 선택하면 이 영역 위의 문서 전체가 해당 버전으로 바뀝니다.</p>
      <div class="policy-history" aria-label="${policy.title} 개정 이력">
      <div class="policy-history-head" aria-hidden="true"><span>버전</span><span>제목</span><span>시행일</span><span>보기</span></div>
      <div class="policy-history-row">
        <span>${policy.version}</span><strong>${policy.subject}</strong><time>${policy.date}</time><button type="button" data-policy-version="${type}">${policy.status}</button>
      </div>
      <div class="policy-history-empty">이전 개정 이력이 없습니다.</div>
      </div>
    </section>
  `;
}

function renderPolicyHistory(type) {
  renderPolicyDocument(type);
  policyContent.querySelector('.policy-history-section')?.scrollIntoView({ block: 'start' });
}

function renderPolicyDocument(type) {
  const policy = policyHistory[type];
  const body = type === 'terms' ? `
    <h3>제1조 목적</h3><p>이 약관은 블라리요 서비스의 이용 조건과 운영자·이용자의 권리와 의무, 게시글 운영, 광고·제휴, 권리자 요청 기준을 정합니다.</p>
    <h3>제2조 정의</h3><p>회원은 네이버·카카오·Google·Apple 계정으로 가입을 완료한 이용자이며, 소셜 계정은 가입과 로그인에 사용하는 외부 인증 제공자 계정입니다.</p>
    <h3>제3조 약관 게시와 변경</h3><p>약관 전문과 시행일을 푸터와 고정 경로에 공개합니다. 중요한 변경은 적용 30일 전, 그 밖의 변경은 원칙적으로 7일 전에 알리고 시행된 이전 전문도 보관합니다.</p>
    <h3>제4조 서비스와 소셜 계정</h3><p>짤 목록·상세·공유·출처·정책과 네 provider 소셜 가입·로그인을 제공합니다. 공개 콘텐츠는 로그인 없이 볼 수 있습니다. 최초 가입에는 provider 동의와 별도로 Blariyo 이용약관 동의와 회원가입 개인정보 수집·이용 동의가 필요하며 소셜 비밀번호는 받거나 저장하지 않습니다.</p>
    <p>회원은 로그아웃·탈퇴할 수 있습니다. 탈퇴 시 회원·연동 정보를 삭제하고 provider가 지원하는 범위에서 연동 해제 또는 token 폐기를 요청합니다. 동일 이메일을 이유로 서로 다른 소셜 계정을 자동 병합하지 않습니다.</p>
    <h3>제5조 게시글 선별과 발행</h3><p>관리자가 보기에 웃긴 콘텐츠를 직접 선별하며 하루 2회, 회당 10~20건 발행을 기본으로 합니다. 자동 수집 후보는 관리자 확인 전 공개하지 않습니다.</p>
    <h3>제6조 외부 콘텐츠와 출처</h3><p>외부 콘텐츠에는 확인 가능한 출처명과 원문 링크를 하단에 한 번 표시합니다. 출처 표시는 권리 확보나 이용 허락을 뜻하지 않습니다.</p>
    <h3>제7조 금지행위</h3><p>타인 계정 도용, 인증 조작, 접근 제한 우회, 과도한 자동 요청, 무단 복제·배포, 권리 침해와 광고 성과 조작을 금지합니다.</p>
    <h3>제8조 광고와 제휴</h3><p>광고와 제휴 콘텐츠는 일반 게시글과 구분하고 수수료 수취 가능성을 가까운 위치에 표시합니다. 광고 차단 안내를 닫은 뒤에는 열람을 제한하지 않습니다.</p>
    <h3>제9조 권리자 요청</h3><p>요청이 접수되면 대상 글을 우선 숨기고 권리 관계와 출처를 확인한 뒤 재공개·수정·삭제 또는 비노출 유지를 결정합니다.</p>
    <h3>제10조 지식재산권</h3><p>서비스 상호·화면·운영자 작성물의 권리는 운영자 또는 정당한 권리자에게, 외부 콘텐츠의 권리는 해당 권리자에게 귀속합니다.</p>
    <h3>제11조 개인정보와 쿠키</h3><p>소셜 인증 세션은 필수 기능으로 처리합니다. GA4와 광고 저장소는 각각 동의한 뒤 활성화하며 거부해도 공개 콘텐츠와 소셜 로그인을 이용할 수 있습니다.</p>
    <h3>제12조 서비스 변경과 중단</h3><p>유지보수, 장애, 보안, 법령 준수 또는 외부 제공자 변경으로 서비스를 변경·중단할 수 있으며 예측 가능한 중대한 변경은 미리 알립니다.</p>
    <h3>제13조 책임 제한</h3><p>통제하기 어려운 외부 제공자 장애와 외부 거래 결과에 관한 책임은 관련 법령 범위에서 정하며 운영자의 고의·중대한 과실 책임을 배제하지 않습니다.</p>
    <h3>제14조 통지와 분쟁 해결</h3><p>서비스 공지는 목록 상단 또는 화면에 표시하고 분쟁은 우선 성실히 협의한 뒤 대한민국 법과 관련 법령상 관할에 따릅니다.</p>
    <h3>제15조 부칙</h3><p>운영자 정보와 시행일이 확정된 v0.1부터 적용하며 과거 전문은 하단 개정 이력에서 확인할 수 있습니다.</p>
  ` : `
    <h3>1. 처리 목적</h3><p>소셜 가입·로그인·계정 관리, 콘텐츠 제공, 보안·오류 대응, 최소 운영 통계, 동의한 GA4·광고, 권리자 요청 처리를 위해 필요한 범위에서 처리합니다.</p>
    <h3>2. 처리 항목과 수집 방법</h3><p>네이버·카카오·Google·Apple의 provider 고유 식별자와 이용자가 동의한 이메일·닉네임·프로필 이미지, Blariyo 회원 번호·동의 이력·로그인 기록을 처리합니다. 소셜 비밀번호는 수신·저장하지 않습니다.</p>
    <p>네이버는 애플리케이션별 id, 카카오는 서비스별 회원번호, Google은 OIDC sub, Apple은 sub를 계정 연결 키로 사용합니다. Apple 이름은 최초 승인 때만 전달될 수 있고 이메일 가리기 중계 주소가 전달될 수 있습니다.</p>
    <h3>3. 내부 식별자</h3><p>내부 통계용 anonymous_id·session_id는 회원 번호, provider 식별자, 이메일, GA client ID와 결합하지 않습니다. GA4에는 회원·소셜 프로필 값을 전송하지 않습니다.</p>
    <h3>4. 보유 기간</h3><p>회원·소셜 연동 정보는 탈퇴까지, OAuth state·nonce·PKCE는 callback 또는 10분 이내, 로그인용 token은 세션 발급까지, 접속·보안 로그와 원시 운영 이벤트는 90일, 쿠키 선택은 12개월 보관합니다.</p>
    <h3>5. 제3자 제공과 소셜 제공자</h3><p>상시 제3자 제공은 하지 않습니다. 소셜 로그인에서는 인증 protocol에 필요한 요청만 provider에 보내고 provider가 이용자 동의에 따라 최소 프로필을 Blariyo에 전달합니다.</p>
    <h3>6. 처리위탁</h3><p>호스팅·이미지·이메일 수탁자와 GA4의 실제 계약 법인·업무·기간을 출시 전에 확정해 공개합니다.</p>
    <h3>7. 국외이전</h3><p>Google·Apple 로그인과 GA4의 실제 이전받는 자, 국가, 항목, 시점·방법, 기간과 거부 효과를 확정하고 적법 근거를 갖춘 뒤 활성화합니다.</p>
    <h3>8. 파기</h3><p>보유 기간 종료, 처리 목적 달성, 탈퇴·동의 철회 시 복구하기 어렵게 삭제하고 법령상 보존 정보는 분리합니다.</p>
    <h3>9. 정보주체 권리</h3><p>열람·정정·삭제·처리정지·동의 철회와 탈퇴를 요청할 수 있습니다. 탈퇴 시 session과 연동 정보를 삭제하고 가능한 범위에서 provider unlink/revoke를 수행합니다.</p>
    <h3>10. 쿠키와 GA4</h3><p>로그인 세션과 OAuth 위조 방지 값은 필수입니다. Google tag와 _ga·_ga_*는 분석 동의 후에만 생성하며 분석·광고를 거부해도 공개 콘텐츠와 소셜 로그인을 이용할 수 있습니다.</p>
    <h3>11. 자동화된 결정과 AI</h3><p>소셜 인증 결과를 보안 검증하지만 개인에게 법적·중대한 영향을 주는 자동 결정은 하지 않고 개인정보를 생성형 AI 학습 데이터로 제공하지 않습니다.</p>
    <h3>12. 안전성 확보 조치</h3><p>OAuth code flow, state·nonce·PKCE, HTTPS, HttpOnly·Secure 세션 쿠키, 최소 권한, provider secret 분리와 접속기록 점검을 적용합니다.</p>
    <h3>13. 보호책임자와 고충 처리</h3><p>개인정보처리자, 보호책임자, 열람청구 담당과 문의 채널은 출시 전에 확정해 공개합니다.</p>
    <h3>14. 권익침해 구제</h3><p>개인정보분쟁조정위원회, 개인정보침해신고센터, 수사기관 등 관련 기관의 연락처를 전문에 제공합니다.</p>
    <h3>15. 변경과 이력</h3><p>변경 내용과 시행일을 미리 알리고 현재 전문과 시행된 이전 전문을 하단 개정 이력에서 제공합니다.</p>
  `;
  policyContent.innerHTML = `
    <div class="policy-document-nav"><strong>${policy.status}</strong><span>${policy.version} · ${policy.date}</span></div>
    <article class="policy-document">${body}</article>
    ${policyHistoryMarkup(type)}
  `;
  policyDialog.scrollTo({ top: 0, behavior: 'auto' });
}

function renderRightsPolicy() {
  policyContent.innerHTML = `
    <form class="policy-form" id="rightsRequestForm">
      <div class="policy-alert"><strong>접수 즉시 우선 숨김</strong><br>요청 대상 게시글은 먼저 숨긴 뒤 관리자가 재공개·수정·삭제 여부를 판단합니다.</div>
      <div class="policy-field"><label for="rightsUrl">대상 게시글 URL</label><input id="rightsUrl" type="url" placeholder="https://__SERVICE_DOMAIN__/posts/1047"></div>
      <div class="policy-field"><label for="rightsType">요청 유형</label><select id="rightsType"><option>게시 중단 요청</option><option>출처 정정 요청</option><option>기타 권리 요청</option></select></div>
      <div class="policy-field"><label for="rightsEmail">회신 이메일</label><input id="rightsEmail" type="email" placeholder="name@example.com"></div>
      <div class="policy-field"><label for="rightsReason">요청 내용</label><textarea id="rightsReason" placeholder="권리 관계와 요청 내용을 적어 주세요."></textarea><span class="policy-help">소명 자료 첨부 방식은 실제 접수 채널 확정 후 연결합니다.</span></div>
      <label class="cookie-option"><span><strong>개인정보 수집·이용 동의 (필수)</strong><span>권리 확인과 결과 회신을 위해 이름·이메일·요청·소명 자료를 처리 완료 후 3년 보관합니다.</span></span><input type="checkbox" required data-rights-consent></label>
      <button class="policy-submit" type="button" data-submit-rights>요청 접수 화면 확인</button>
      <p class="policy-status" id="rightsStatus" aria-live="polite"></p>
    </form>
  `;
}

function renderCookiePolicy() {
  const analyticsChecked = cookieConsent?.analytics ? ' checked' : '';
  const adsChecked = cookieConsent?.ads ? ' checked' : '';
  policyContent.innerHTML = `
    <div class="cookie-list">
      <label class="cookie-option"><span><strong>필수 쿠키</strong><span>보안, 소셜 로그인 세션, OAuth 위조 방지, 쿠키 선택 저장에 사용합니다.</span></span><input type="checkbox" checked disabled></label>
      <label class="cookie-option"><span><strong>분석 쿠키</strong><span>동의 후 GA4로 방문 흐름과 화면 이용 현황을 분석합니다. 회원·소셜 식별자는 보내지 않습니다.</span></span><input type="checkbox" data-cookie="analytics"${analyticsChecked}></label>
      <label class="cookie-option"><span><strong>광고 쿠키</strong><span>광고 노출과 성과 측정에 사용합니다.</span></span><input type="checkbox" data-cookie="ads"${adsChecked}></label>
      <button class="policy-submit" type="button" data-save-cookies>선택 저장</button>
      <p class="policy-status" id="cookieStatus" aria-live="polite"></p>
    </div>
  `;
}

function openPolicyModal(type) {
  currentPolicy = type;
  modalReturnFocus = document.activeElement;
  closeShareMenu(false);
  policyTitle.textContent = policyHistory[type]?.title || (type === 'rights' ? '권리자 요청' : '쿠키 설정');
  policyDescription.textContent = policyHistory[type]?.description || (type === 'rights' ? '권리 요청을 접수하고 처리 원칙을 확인합니다.' : '선택 쿠키의 사용 여부를 직접 관리합니다.');
  if (policyHistory[type]) renderPolicyDocument(type);
  if (type === 'rights') renderRightsPolicy();
  if (type === 'cookies') renderCookiePolicy();
  policyModal.hidden = false;
  document.body.classList.add('modal-open');
  modalBackground.forEach((element) => { element.inert = true; });
  policyDialog.focus();
}

function closePolicyModal() {
  if (policyModal.hidden) return;
  policyModal.hidden = true;
  document.body.classList.remove('modal-open');
  modalBackground.forEach((element) => { element.inert = false; });
  if (modalReturnFocus instanceof HTMLElement) modalReturnFocus.focus();
  currentPolicy = null;
}

function announceShare(message) {
  shareStatus.textContent = message;
}

async function copyShareUrl() {
  const url = 'https://__SERVICE_DOMAIN__/posts/1047';
  try {
    await navigator.clipboard.writeText(url);
    announceShare('게시글 링크를 복사했습니다.');
  } catch {
    announceShare(`복사 권한을 사용할 수 없습니다. 링크: ${url}`);
  }
}

async function runShare(type) {
  const url = 'https://__SERVICE_DOMAIN__/posts/1047';
  const title = '퇴근 직전에 질문 하나만 하겠다는 사람의 진짜 의미';

  if (type === 'copy') await copyShareUrl();
  if (type === 'x') window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
  if (type === 'kakao') {
    if (window.Kakao?.Share) {
      window.Kakao.Share.sendDefault({ objectType: 'feed', content: { title, description: '블라리요 게시글', imageUrl: 'https://__SERVICE_DOMAIN__/og/posts/1047-1200x630.jpg', link: { mobileWebUrl: url, webUrl: url } } });
    } else {
      announceShare('정적 프로토타입에서는 카카오 공유 실행 대신 배치만 확인합니다.');
    }
  }
  if (type === 'native') {
    if (navigator.share) await navigator.share({ title, url });
    else await copyShareUrl();
  }
  if (type !== 'kakao') closeShareMenu();
}

renderRows('#homeRows', homePosts, { adAfterIndex: 5, adLabel: '목록 중간 광고', notices: pinnedNotices });
renderRows('#detailRows', detailPosts, { adAfterIndex: 9, adLabel: '상세 하단 목록 중간 광고', markCurrent: true });

document.addEventListener('click', (event) => {
  const policyLink = event.target.closest('[data-policy]');
  if (policyLink) {
    event.preventDefault();
    openPolicyModal(policyLink.dataset.policy);
  }

  const screenButton = event.target.closest('[data-screen]');
  if (screenButton) showScreen(screenButton.dataset.screen, { focus: true });

  const goTarget = event.target.closest('[data-go]');
  if (goTarget) {
    event.preventDefault();
    showScreen(goTarget.dataset.go, { focus: true });
  }

  const shareAction = event.target.closest('[data-share]');
  if (shareAction) runShare(shareAction.dataset.share).catch(() => announceShare('공유를 완료하지 못했습니다.'));

  if (event.target.closest('[data-open-adblock]')) openAdblockModal();
  if (event.target.closest('[data-close-adblock]')) closeAdblockModal();
  if (event.target.closest('[data-close-policy]')) closePolicyModal();
  if (event.target.closest('[data-close-share]')) closeShareMenu();

  const versionButton = event.target.closest('[data-policy-version]');
  if (versionButton) renderPolicyDocument(versionButton.dataset.policyVersion);

  const historyButton = event.target.closest('[data-policy-history]');
  if (historyButton) renderPolicyHistory(historyButton.dataset.policyHistory);

  const guideButton = event.target.closest('[data-toggle-adblock-guide]');
  if (guideButton) {
    adblockGuide.hidden = !adblockGuide.hidden;
    guideButton.setAttribute('aria-expanded', String(!adblockGuide.hidden));
  }

  if (event.target.closest('[data-submit-rights]')) {
    const consent = policyContent.querySelector('[data-rights-consent]');
    document.getElementById('rightsStatus').textContent = consent?.checked
      ? '정적 퍼블리싱에서는 입력과 필수 동의, 접수 완료 상태만 확인합니다.'
      : '개인정보 수집·이용 필수 동의를 확인해 주세요.';
  }

  if (event.target.closest('[data-save-cookies]')) {
    saveCookieConsent({
      analytics: policyContent.querySelector('[data-cookie="analytics"]')?.checked,
      ads: policyContent.querySelector('[data-cookie="ads"]')?.checked
    });
    closePolicyModal();
  }

  if (event.target.closest('[data-cookie-essential]')) saveCookieConsent({ analytics: false, ads: false });
  if (event.target.closest('[data-cookie-all]')) saveCookieConsent({ analytics: true, ads: true });
  if (event.target.closest('[data-cookie-settings]')) openPolicyModal('cookies');

  if (shareMenu && !shareMenu.hidden && !shareMenu.contains(event.target) && event.target !== shareButton) closeShareMenu(false);
});

screenTabs.forEach((tab, index) => tab.addEventListener('keydown', (event) => {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  let nextIndex = index;
  if (event.key === 'ArrowLeft') nextIndex = (index - 1 + screenTabs.length) % screenTabs.length;
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % screenTabs.length;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = screenTabs.length - 1;
  screenTabs[nextIndex].focus();
  showScreen(screenTabs[nextIndex].dataset.screen);
}));

shareButton.addEventListener('click', () => {
  if (shareMenu.hidden) openShareMenu();
  else closeShareMenu();
});

window.addEventListener('resize', () => { if (!shareMenu.hidden) positionShareMenu(); });
window.addEventListener('scroll', () => { if (!shareMenu.hidden) positionShareMenu(); }, { passive: true });

policyModal.addEventListener('click', (event) => {
  if (event.target === policyModal) closePolicyModal();
});

adblockModal.addEventListener('click', (event) => {
  if (event.target === adblockModal) closeAdblockModal();
});

document.addEventListener('keydown', (event) => {
  if (!policyModal.hidden && event.key === 'Tab') trapModalFocus(policyDialog, event);
  if (!adblockModal.hidden && event.key === 'Tab') trapModalFocus(adblockDialog, event);
  if (!policyModal.hidden && event.key === 'Escape') {
    closePolicyModal();
    return;
  }
  if (!adblockModal.hidden && event.key === 'Escape') {
    closeAdblockModal();
    return;
  }
  if (event.key === 'Escape') closeShareMenu();
});

const requestedScreen = location.hash.slice(1);
showScreen(screens.some((screen) => screen.dataset.view === requestedScreen) ? requestedScreen : 'home');
cookieBanner.hidden = Boolean(cookieConsent);
