import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();
  const password = 'correct horse battery staple';

  it('hashes passwords with the configured Argon2id work factors', async () => {
    const passwordHash = await service.hash(password);

    expect(passwordHash).toContain('$argon2id$');
    expect(passwordHash).toContain('m=19456');
    expect(passwordHash).toContain('t=2');
    expect(passwordHash).toContain('p=1');
    expect(passwordHash).not.toContain(password);
  });

  it('verifies the correct password and rejects an incorrect password', async () => {
    const passwordHash = await service.hash(password);

    await expect(service.verify(passwordHash, password)).resolves.toBe(true);
    await expect(
      service.verify(passwordHash, 'incorrect password'),
    ).resolves.toBe(false);
  });
});
