const legacyChecksums: Readonly<Record<string, string>> = {
  V001: 'af6e9efc9a6708e8b02946d4c7507808c61b37feb4004a98c19f98caa5657fe7',
  V002: '6e9871db8696ca8d351c3ca2e13e9836a5ab30e0538ce800f1b4aeb8d0eb1ca4',
  V003: '8f5d4399c91e21a50d55795663bad96cd315cec8cc10453e2420f4eb4e7c28e5',
  V004: '0870c4e70f7fbebc0b91c62221c198590733fabee63134ba4f20428950a660d8',
  V005: 'f2b1eec3d575bc27f58368eb1f1a6d5c902db2bd7052f6b70ff5a49ed96b8afb',
  V006: '2e5e842bf6ac63947bb004afa3ca9e9b1cc3da628f6276ceff6b855edc866acc',
  V007: 'dda8a1ac947d62adfdf4bde41ba9f05262a13fb5dd89850bc438284513181378',
  V008: 'c92e98be23a0e0976ed75381f2da0d78227b1891a02c8c253257eade766e0251',
};

export function migrationChecksumMatches(version: string, current: Buffer, applied: Buffer) {
  return current.equals(applied) || legacyChecksums[version] === applied.toString('hex');
}
