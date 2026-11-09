# Branching and release workflow

This repository uses a small, pull-request-based workflow suited to a short technical assignment. The existing commit history was created directly on `develop`; the steps below describe the intended workflow for subsequent changes, not a claim that past commits went through pull requests.

## Branch roles

- `main` is the intended stable submission branch. It should contain a tested, runnable version.
- `develop` is the integration branch for completed work before promotion to `main`.
- `feature/<short-name>` branches start from `develop` and are merged back through a pull request. Use `fix/<short-name>` for a focused bug fix.
- `hotfix/<short-name>` branches start from `main` for urgent fixes to a submitted release. Merge them back to both `main` and `develop` so the branches do not diverge.

## Typical change

1. Update `develop` and create a short-lived branch, for example `feature/appointment-search`.
2. Make focused commits using Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, or `test:`.
3. Run the relevant service lint and tests, plus `node scripts/acceptance.mjs` for changes that affect the running stack.
4. Open a pull request into `develop` describing the change and the checks performed. Review the diff and resolve feedback.
5. Once the integrated version is ready, verify a fresh checkout and open a pull request from `develop` to `main`.
6. After that pull request is merged, optionally tag the tested commit with a version such as `v1.0.0`.

## Current submission status

The first MVP was developed on `develop` and is promoted to `main` through a pull request. Until that pull request is merged, share the `develop` branch link with reviewers. No branch-protection or automated CI enforcement is assumed; configure those in GitHub if desired and describe them only once they are actually enabled.

## Verification before promotion

- Start with a fresh checkout of the candidate commit and a fresh set of Docker volumes; follow the README's quickstart.
- Confirm the health endpoints and run `node scripts/acceptance.mjs`.
- Run service tests and coverage, and verify the intended files are committed. Do not commit `.env` or real secrets.
- Review the pull request diff and ensure the target branch and commit are correct.
