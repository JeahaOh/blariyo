const checksumTransitions: Readonly<Record<string, { previous: string; current: string }>> = {
  V001: {
    previous: 'af6e9efc9a6708e8b02946d4c7507808c61b37feb4004a98c19f98caa5657fe7',
    current: '9b57c7b5766a36e6e101ee9f8bfbc6e899346554ab7e41e10ca2f3ac49277e6a',
  },
  V002: {
    previous: '6e9871db8696ca8d351c3ca2e13e9836a5ab30e0538ce800f1b4aeb8d0eb1ca4',
    current: '382e4b187644162e4542592caa027b4dd682cb611eaa339cba3c53847482a66f',
  },
  V003: {
    previous: '8f5d4399c91e21a50d55795663bad96cd315cec8cc10453e2420f4eb4e7c28e5',
    current: '6801e366687670e81b8e57a6bdff1f2b40d8d226586d9432e167e777ca392ae6',
  },
  V004: {
    previous: '0870c4e70f7fbebc0b91c62221c198590733fabee63134ba4f20428950a660d8',
    current: 'f767172d10c7ce0696e4b2fd688aa98071bfbb410a7face4eade09bb8a9f65ce',
  },
  V005: {
    previous: 'f2b1eec3d575bc27f58368eb1f1a6d5c902db2bd7052f6b70ff5a49ed96b8afb',
    current: 'b4bad6c9016e3621b88d017a6ed222fd1767eef50c397f22ff6789691f8ddff9',
  },
  V006: {
    previous: '2e5e842bf6ac63947bb004afa3ca9e9b1cc3da628f6276ceff6b855edc866acc',
    current: 'd8377b1a428b119e4fb338135be8bc174d43eb1be52a5862bf2ae60b73b3d1b6',
  },
  V007: {
    previous: 'dda8a1ac947d62adfdf4bde41ba9f05262a13fb5dd89850bc438284513181378',
    current: '236eb16a398b633c5151af89ec6f7a577b3aa2ff0bc6d2a7b76993f19d40a598',
  },
  V008: {
    previous: 'c92e98be23a0e0976ed75381f2da0d78227b1891a02c8c253257eade766e0251',
    current: '1bddc58cd37185599e21677cd3d580202e957ec510cdced4d8aa33f3c5d20ef5',
  },
};

export function migrationChecksumMatches(version: string, current: Buffer, applied: Buffer) {
  const transition = checksumTransitions[version];
  return (
    current.equals(applied) ||
    (transition?.previous === applied.toString('hex') &&
      transition.current === current.toString('hex'))
  );
}
