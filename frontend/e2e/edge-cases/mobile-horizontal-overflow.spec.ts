import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { getCommunitySlug } from '../fixtures/community-helpers';
import { CommunityPage } from '../pages/CommunityPage';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { assertNoHorizontalOverflow } from '../utils/assertions';

/**
 * E2E Tests for Mobile Horizontal Overflow
 *
 * A page that is a few pixels wider than the phone lets the user drag it
 * sideways, even though nothing looks broken. Each test here pins one page that
 * did exactly that, at the narrow end of common phone widths:
 *
 * - Header rows of `<Button>`s that did not wrap (Button is whitespace-nowrap,
 *   so a row of them can only fit by wrapping)
 * - HelpTooltip panels hidden with `invisible`, which still occupy layout space
 *
 * Read-only: nothing here changes fixture state.
 */

test.use({ viewport: { width: 360, height: 740 } });

test.describe('@mobile Mobile horizontal overflow', () => {
  test('games list filter bar and pagination fit the viewport', async ({ page }) => {
    await loginAs(page, 'GM');
    await page.goto('/games');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Not Joined' })).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });

  test('GM actions tab header fits the viewport', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToTab('Actions');
    await expect(page.getByTestId('standalone-result-button')).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });

  test('GM phases tab header fits the viewport', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToTab('Phases');
    await expect(page.getByRole('button', { name: 'New Phase' })).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });

  test('GM participants list header fits the viewport', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToTab('People');
    await page.getByRole('button', { name: /Game Participants/ }).click();
    await expect(page.getByRole('button', { name: 'Add Audience Member' })).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });

  test('community settings help tooltip does not widen the page', async ({ page }) => {
    await loginAs(page, 'GM');
    const community = new CommunityPage(page, getCommunitySlug('RAVENS'));
    await community.gotoManage('settings');
    await expect(page.getByTestId('community-banner-section')).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });
});
