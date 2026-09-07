const reasons = {
  fileSize: '파일 크기가 10MiB를 초과합니다.',
  format: '지원하지 않는 이미지 형식입니다. JPEG·PNG·WebP·GIF를 사용해 주세요.',
  decodeLimit: '이미지 해상도 또는 애니메이션 프레임 한도를 초과합니다.',
  decode: '이미지를 읽을 수 없습니다. 손상 여부를 확인해 주세요.',
};
export function uploadError(error, files) {
  const details =
    error?.code === 'UNSUPPORTED_MEDIA_TYPE' || error?.code === 'UPLOAD_TOO_LARGE'
      ? (error.fields || []).flatMap(({ field, reason }) => {
          const match = /^files\[(\d+)\]$/.exec(field);
          const index = match ? Number(match[1]) : -1;
          return files[index]
            ? [
                {
                  index,
                  name: files[index].name,
                  reason: reasons[reason] || '파일을 확인해 주세요.',
                },
              ]
            : [];
        })
      : [];
  return {
    message: details.length
      ? '업로드하지 못했습니다. 아래 파일을 확인한 뒤 전체 파일을 다시 선택해 주세요.'
      : error?.code === 'UPLOAD_TOO_LARGE'
        ? '요청 용량 또는 파일 수 한도를 초과했습니다. 한 번에 최대 10개, 전체 100MiB 이내로 올려 주세요.'
        : error?.code === 'DEPENDENCY_UNAVAILABLE'
          ? '저장소에 연결하지 못했습니다. 잠시 후 전체 파일을 다시 올려 주세요.'
          : '이미지를 올리지 못했습니다. 파일을 확인한 뒤 다시 시도해 주세요.',
    details,
  };
}
