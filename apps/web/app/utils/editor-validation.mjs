// Client feedback only. The API remains authoritative for validation and state transitions.
/**
 * @param {{title: string, blocks: Array<{type: string, text?: string, alt?: string}>}} editor
 * @param {string} sourceName
 * @param {string} sourceUrl
 * @returns {Record<string, string>}
 */
export function editorErrors(editor, sourceName, sourceUrl) {
  /** @type {Record<string, string>} */
  const errors = {};
  /** @param {string | undefined} value */
  const length = (value) => [...(value || '').trim()].length;
  if (!length(editor.title) || length(editor.title) > 200)
    errors.title = '제목을 1~200자로 입력해 주세요.';
  if (sourceName || sourceUrl) {
    if (!length(sourceName) || length(sourceName) > 200)
      errors.sourceName = '출처명을 1~200자로 입력해 주세요.';
    try {
      if (
        !sourceUrl.startsWith('https://') ||
        new URL(sourceUrl).protocol !== 'https:' ||
        sourceUrl.length > 2048
      )
        throw new Error();
    } catch {
      errors.sourceUrl = '출처 URL을 https://로 시작하는 주소로 입력해 주세요.';
    }
  }
  if (!editor.blocks.length || editor.blocks.length > 40)
    errors.blocks = '본문 블록을 1~40개 구성해 주세요.';
  if (editor.blocks.filter((b) => b.type === 'IMAGE').length > 20)
    errors.blocks = '이미지는 게시글당 최대 20개까지 사용할 수 있습니다.';
  editor.blocks.forEach((block, index) => {
    const key = `block-${index}`;
    if (block.type === 'TEXT' && (!length(block.text) || length(block.text) > 20000))
      errors[key] = '본문을 1~20,000자로 입력하거나 빈 블록을 제거해 주세요.';
    if (block.type === 'IMAGE' && (!length(block.alt) || length(block.alt) > 300))
      errors[key] = '이미지 대체 텍스트를 1~300자로 입력해 주세요.';
  });
  return errors;
}
