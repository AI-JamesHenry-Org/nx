import * as childProcess from 'node:child_process';
import { GithubRemoteReleaseClient } from './github';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axiosGetMock = jest.requireMock('axios').get as jest.Mock;

describe('GithubRemoteReleaseClient', () => {
  const execFileSyncSpy = jest.spyOn(childProcess, 'execFileSync');
  const client = new GithubRemoteReleaseClient(
    {
      hostname: 'github.com',
      slug: 'nrwl/nx',
      apiBaseUrl: 'https://api.github.com',
    },
    false,
    null
  );

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should prefer the username returned by ungh', async () => {
    axiosGetMock.mockResolvedValue({
      data: {
        user: {
          username: 'from-ungh',
        },
      },
    });
    const authors = new Map([
      ['Test User', { email: new Set(['test@example.com']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBe('from-ungh');
    expect(execFileSyncSpy).not.toHaveBeenCalled();
  });

  it('should fall back to gh api when ungh does not return a username', async () => {
    axiosGetMock.mockResolvedValue({
      data: {
        user: null,
      },
    });
    execFileSyncSpy.mockReturnValue(
      JSON.stringify({
        items: [{ login: 'from-gh' }],
      })
    );
    const authors = new Map([
      ['Test User', { email: new Set(['test@example.com']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBe('from-gh');
    expect(execFileSyncSpy).toHaveBeenCalledWith(
      'gh',
      [
        'api',
        '--hostname',
        'github.com',
        '--method',
        'GET',
        'search/users',
        '-f',
        'q=test@example.com in:email',
      ],
      expect.objectContaining({
        encoding: 'utf8',
        stdio: 'pipe',
        windowsHide: false,
      })
    );
  });

  it('should fall back to gh api when ungh fails', async () => {
    axiosGetMock.mockRejectedValue(new Error('ungh unavailable'));
    execFileSyncSpy.mockReturnValue(
      JSON.stringify({
        items: [{ login: 'from-gh' }],
      })
    );
    const authors = new Map([
      ['Test User', { email: new Set(['test@example.com']) }],
    ]);

    await client.applyUsernameToAuthors(authors);

    expect(authors.get('Test User')?.username).toBe('from-gh');
  });

  it('should leave the username unset when both lookups fail', async () => {
    axiosGetMock.mockRejectedValue(new Error('ungh unavailable'));
    execFileSyncSpy.mockImplementation(() => {
      throw new Error('gh unavailable');
    });
    const authors = new Map([
      ['Test User', { email: new Set(['test@example.com']) }],
    ]);

    await expect(
      client.applyUsernameToAuthors(authors)
    ).resolves.toBeUndefined();
    expect(authors.get('Test User')?.username).toBeUndefined();
  });
});
