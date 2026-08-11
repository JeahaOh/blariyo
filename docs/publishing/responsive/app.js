const posts = [
  '회의 시작 5분 전에 모두가 갑자기 바빠지는 이유',
  '퇴근 직전에 질문 하나만 하겠다는 사람의 진짜 의미',
  '간식을 숨긴 위치를 정확히 기억하고 있던 고양이',
  '배달 메뉴를 20분 보고 결국 냉장고를 연 사람',
  '온라인 후기에서 별점보다 먼저 봐야 하는 문장',
  '분명 하나만 사러 갔는데 계산대에서 만난 장바구니',
  '팀장님이 잠깐 보자고 했을 때 머릿속에 스치는 생각',
  '엘리베이터 닫힘 버튼을 누른 사람들의 조용한 연대',
  '비 오는 날 우산을 챙긴 사람이 가장 먼저 하는 말',
  '월요일 아침 컴퓨터 업데이트가 알려준 삶의 진실',
  '카페에서 콘센트 자리를 발견했을 때의 표정 관리',
  '택배 도착 알림 하나로 하루가 살아나는 순간',
  '회의록을 쓰다 보면 갑자기 기억력이 좋아지는 이유',
  '점심 메뉴 정하기가 프로젝트보다 어려운 이유',
  '충전기 빌려달라는 말에 사무실이 조용해지는 순간',
  '분명 쉬러 갔는데 더 피곤해져서 돌아온 주말',
  '고양이가 모니터 앞에 앉는 정확한 타이밍',
  '냉장고 문을 열고 뭘 찾는지 잊어버린 사람',
  '출근길 이어폰 배터리 3퍼센트가 주는 긴장감',
  '알람을 끄고 눈을 감은 5분의 위험성'
];

function createPostRow(title, index) {
  const no = 1048 - index;
  const board = index % 4 === 3 ? '이야기' : '유머';
  const views = [812, 1248, 967, 704, 533, 411, 388, 351, 320, 297, 266, 244, 231, 219, 201, 188, 173, 160, 142, 128][index];
  const hour = String(14 - Math.floor(index / 2)).padStart(2, '0');
  const minute = index % 2 === 0 ? '30' : '05';

  const row = document.createElement('div');
  row.className = 'board-row';
  row.tabIndex = 0;
  row.dataset.go = 'detail';
  row.innerHTML = `
    <span class="muted">${no}</span>
    <span class="board-name">${board}</span>
    <span>${title}</span>
    <span class="muted">${views.toLocaleString('ko-KR')}</span>
    <span class="muted">운영자</span>
    <span class="muted">${hour}:${minute}</span>
  `;
  return row;
}

function createAdRow(label) {
  const ad = document.createElement('div');
  ad.className = 'ad-row';
  ad.textContent = label;
  return ad;
}

function renderRows(target, options = {}) {
  const container = document.querySelector(target);
  if (!container) return;
  container.replaceChildren();

  posts.forEach((title, index) => {
    container.appendChild(createPostRow(title, index));
    if (index === options.adAfterIndex) {
      container.appendChild(createAdRow(options.adLabel));
    }
  });
}

function showScreen(name) {
  document.querySelectorAll('[data-view]').forEach((screen) => {
    screen.classList.toggle('is-active', screen.dataset.view === name);
  });
  document.querySelectorAll('[data-screen]').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.screen === name);
  });
  history.replaceState(null, '', `#${name}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

renderRows('#homeRows', {
  adAfterIndex: 5,
  adLabel: 'AD-FEED-INLINE · 홈 목록 중간 광고'
});
renderRows('#detailRows', {
  adAfterIndex: 5,
  adLabel: 'AD-DETAIL-LIST-INLINE · 상세 하단 목록 중간 광고'
});

document.addEventListener('click', (event) => {
  const screenButton = event.target.closest('[data-screen]');
  if (screenButton) showScreen(screenButton.dataset.screen);

  const goTarget = event.target.closest('[data-go]');
  if (goTarget) {
    event.preventDefault();
    showScreen(goTarget.dataset.go);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const row = event.target.closest('.board-row[data-go]');
  if (row) showScreen(row.dataset.go);
});

showScreen(location.hash.slice(1) || 'home');
