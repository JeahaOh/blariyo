const homePosts = [
  [1048, '유머', '회의 시작 5분 전에 모두가 갑자기 바빠지는 이유', 812, '14:30'],
  [1047, '유머', '퇴근 직전에 질문 하나만 하겠다는 사람의 진짜 의미', 1248, '14:05'],
  [1046, '이야기', '간식을 숨긴 위치를 정확히 기억하고 있던 고양이', 967, '13:30'],
  [1045, '이야기', '배달 메뉴를 20분 보고 결국 냉장고를 연 사람', 704, '13:05'],
  [1044, '유머', '온라인 후기에서 별점보다 먼저 봐야 하는 문장', 533, '12:30'],
  [1043, '이야기', '분명 하나만 사러 갔는데 계산대에서 만난 장바구니', 411, '12:05'],
  [1042, '유머', '팀장님이 잠깐 보자고 했을 때 머릿속에 스치는 생각', 388, '11:30'],
  [1041, '이야기', '엘리베이터 닫힘 버튼을 누른 사람들의 조용한 연대', 351, '11:05'],
  [1040, '유머', '비 오는 날 우산을 챙긴 사람이 가장 먼저 하는 말', 320, '10:30'],
  [1039, '이야기', '월요일 아침 컴퓨터 업데이트가 알려준 삶의 진실', 297, '10:05'],
  [1038, '유머', '카페에서 콘센트 자리를 발견했을 때의 표정 관리', 266, '09:30'],
  [1037, '이야기', '택배 도착 알림 하나로 하루가 살아나는 순간', 244, '09:05'],
  [1036, '유머', '회의록을 쓰다 보면 갑자기 기억력이 좋아지는 이유', 231, '08:30'],
  [1035, '이야기', '점심 메뉴 정하기가 프로젝트보다 어려운 이유', 219, '08:05'],
  [1034, '유머', '충전기 빌려달라는 말에 사무실이 조용해지는 순간', 201, '8월 11일'],
  [1033, '이야기', '분명 쉬러 갔는데 더 피곤해져서 돌아온 주말', 188, '8월 11일'],
  [1032, '유머', '고양이가 모니터 앞에 앉는 정확한 타이밍', 173, '8월 11일'],
  [1031, '이야기', '냉장고 문을 열고 뭘 찾는지 잊어버린 사람', 160, '8월 11일'],
  [1030, '유머', '출근길 이어폰 배터리 3퍼센트가 주는 긴장감', 142, '8월 11일'],
  [1029, '이야기', '알람을 끄고 눈을 감은 5분의 위험성', 128, '8월 11일']
].map(([no, board, title, views, time]) => ({ no, board, title, views, time }));

const detailPosts = Array.from({ length: 20 }, (_, index) => {
  const no = 1056 - index;
  const sample = homePosts.find((post) => post.no === no);
  return sample || {
    no,
    board: '유머',
    title: `같은 유머 게시판의 현재 글 주변 게시글 ${no}`,
    views: 760 - index * 21,
    time: index < 10 ? `${String(14 - index).padStart(2, '0')}:20` : '8월 11일'
  };
}).map((post) => ({ ...post, board: '유머' }));

const currentPostNo = 1047;
const screens = Array.from(document.querySelectorAll('[data-view]'));
const screenTabs = Array.from(document.querySelectorAll('[data-screen]'));
const shareButton = document.getElementById('shareButton');
const shareMenu = document.getElementById('shareMenu');
const shareStatus = document.getElementById('shareStatus');
const stateHeading = document.getElementById('stateHeading');

function createPostRow(post, { current = false } = {}) {
  const row = document.createElement(current ? 'div' : 'a');
  row.className = `board-row${current ? ' is-current' : ''}`;

  if (current) {
    row.setAttribute('aria-current', 'true');
    row.setAttribute('aria-disabled', 'true');
  } else {
    row.href = `/posts/${post.no}`;
    row.dataset.go = 'detail';
  }

  row.innerHTML = `
    <span class="muted">${post.no}</span>
    <span class="board-name">${post.board}</span>
    <span>${post.title}${current ? ' <small>(현재 글)</small>' : ''}</span>
    <span class="muted">${post.views.toLocaleString('ko-KR')}</span>
    <span class="muted">운영자</span>
    <span class="muted">${post.time}</span>
  `;
  return row;
}

function createAdRow(label) {
  const ad = document.createElement('div');
  ad.className = 'ad-row';
  ad.setAttribute('role', 'complementary');
  ad.setAttribute('aria-label', '광고');
  ad.textContent = label;
  return ad;
}

function renderRows(target, posts, { adAfterIndex, adLabel, markCurrent = false }) {
  const container = document.querySelector(target);
  if (!container) return;
  container.replaceChildren();

  posts.forEach((post, index) => {
    container.appendChild(createPostRow(post, { current: markCurrent && post.no === currentPostNo }));
    if (index === adAfterIndex) container.appendChild(createAdRow(adLabel));
  });
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

  history.replaceState(null, '', `#${name}`);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  closeShareMenu(false);
  if (focus) (next.querySelector('h1') || next).focus({ preventScroll: true });
}

function openShareMenu() {
  shareMenu.hidden = false;
  shareButton.setAttribute('aria-expanded', 'true');
  shareMenu.querySelector('[role="menuitem"]').focus();
}

function closeShareMenu(restoreFocus = true) {
  if (!shareMenu || shareMenu.hidden) return;
  shareMenu.hidden = true;
  shareButton.setAttribute('aria-expanded', 'false');
  if (restoreFocus) shareButton.focus();
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
      announceShare('정적 프로토타입에서는 카카오 SDK를 로드하지 않습니다. 실제 route에서 SDK 공유를 실행합니다.');
    }
  }
  if (type === 'native') {
    if (navigator.share) await navigator.share({ title, url });
    else await copyShareUrl();
  }
  if (type !== 'kakao') closeShareMenu();
}

renderRows('#homeRows', homePosts, {
  adAfterIndex: 5,
  adLabel: '광고 · AD-FEED-INLINE · 게시글 20개 산정 제외'
});
renderRows('#detailRows', detailPosts, {
  adAfterIndex: 9,
  adLabel: '광고 · AD-DETAIL-LIST-INLINE · 게시글 20개 산정 제외',
  markCurrent: true
});

document.addEventListener('click', (event) => {
  const screenButton = event.target.closest('[data-screen]');
  if (screenButton) showScreen(screenButton.dataset.screen, { focus: true });

  const goTarget = event.target.closest('[data-go]');
  if (goTarget) {
    event.preventDefault();
    showScreen(goTarget.dataset.go, { focus: true });
  }

  const shareAction = event.target.closest('[data-share]');
  if (shareAction) runShare(shareAction.dataset.share).catch(() => announceShare('공유를 완료하지 못했습니다. 다시 시도해 주세요.'));

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

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeShareMenu();
});

document.querySelectorAll('[data-state]').forEach((button) => button.addEventListener('click', () => {
  const name = button.dataset.state;
  showScreen(name, { focus: true });
}));

const requestedScreen = location.hash.slice(1);
showScreen(screens.some((screen) => screen.dataset.view === requestedScreen) ? requestedScreen : 'home');
if (stateHeading) stateHeading.tabIndex = -1;
