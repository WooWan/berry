import {npath, xfs} from '@yarnpkg/fslib';

const {
  tests: {testIf},
} = require(`pkg-tests-core`);

const {
  exec: {execFile},
  tests: {validLogins},
} = require(`pkg-tests-core`);

describe(`publish`, () =>   {
  test(`it should detect the gitHead for this repo`, makeTemporaryEnv({
    name: `githead-required`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await execFile(`git`, [`init`], {cwd: path});

    // Otherwise we can't always commit
    await execFile(`git`, [`config`, `user.name`, `John Doe`], {cwd: path});
    await execFile(`git`, [`config`, `user.email`, `john.doe@example.org`], {cwd: path});
    await execFile(`git`, [`config`, `commit.gpgSign`, `false`], {cwd: path});

    await execFile(`git`, [`add`, `.`], {cwd: path});
    await execFile(`git`, [`commit`, `-m`, `wip`], {cwd: path});

    await run(`install`);

    await run(`npm`, `publish`, {
      env: {
        YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
      },
    });
  }));

  test(`it should not detect the gitHead for this repo`, makeTemporaryEnv({
    name: `githead-forbidden`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);

    await run(`npm`, `publish`, {
      env: {
        YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
      },
    });
  }));

  test(`should fail when invalid otp is given`,
    makeTemporaryEnv({
      name: `otp-required`,
      version: `1.0.0`,
    }, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`npm`, `publish`, `--otp`, `invalid_otp`, {
        env: {
          YARN_NPM_AUTH_TOKEN: validLogins.otpUser.npmAuthToken,
        },
      })).rejects.toThrowError(/Invalid OTP token/);
    }));

  test(`should accept an otp and skip prompting for it`, makeTemporaryEnv({
    name: `otp-required`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);

    await expect(run(`npm`, `publish`, `--otp`, validLogins.otpUser.npmOtpToken, {
      env: {
        YARN_NPM_AUTH_TOKEN: validLogins.otpUser.npmAuthToken,
      },
    })).resolves.toBeTruthy();
  }));

  test(`should publish a package with the readme content`, makeTemporaryEnv({
    name: `readme-required`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);

    const readmePath = npath.toPortablePath(`${path}/README.md`);
    await xfs.writeFilePromise(readmePath, `# title\n`);

    await run(`npm`, `publish`, {
      env: {
        YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
      },
    });
  }));

  testIf(
    () => !!process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
    `should publish a package with a valid provenance statement`,
    makeTemporaryEnv({
      name: `provenance-required`,
      version: `1.0.0`,
    }, async ({run}) => {
      await run(`install`);

      const githubEnv = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => (
          key.startsWith(`ACTIONS_`) || key.startsWith(`GITHUB_`) || key.startsWith(`RUNNER_`)),
        ),
      );

      await run(`npm`, `publish`, {
        env: {
          ...githubEnv,
          YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
          YARN_NPM_PUBLISH_PROVENANCE: `true`,
        },
      });
    }),
  );
});
