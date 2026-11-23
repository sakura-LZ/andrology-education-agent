// 本地浏览器回归：使用隔离口令，不读取或输出实际密钥。
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const runtime = process.env.CODEX_TEST_NODE_MODULES || 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules';
const { chromium } = require(runtime + '/playwright');
const url = 'http://127.0.0.1:3362';
(async () => {
  const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: '3362', HOST: '127.0.0.1', ACCESS_TOKEN: 'ui-test-access', TEACHER_TOKEN: 'ui-test-teacher', RATE_LIMIT: '500' }, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 50; i++) {
      try { await fetch(url); break; } catch { await delay(100); }
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
    await page.goto(url);
    await page.locator('#authDialog').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('#authInput').fill('wrong');
    await page.locator('#authSubmit').click();
    await page.locator('#authError').filter({ hasText: '口令' }).waitFor();
    await page.locator('#authInput').fill('ui-test-access');
    await page.locator('#authSubmit').click();
    await page.waitForFunction(() => document.getElementById('connectionStatus').textContent.includes('37 篇'));
    await page.locator('#modulesBtn').click();
    assert.equal(await page.locator('#kbGrid .kb-card').count(), 28);
    await page.locator('#kbSearch').fill('流式');
    assert.ok(await page.locator('#kbGrid .kb-card').count() >= 1);
    await page.locator('#kbGrid .kb-card').first().click();
    assert.ok((await page.locator('#kbContent').innerText()).includes('流式'));
    await page.locator('#kbDetailBack').click();
    await page.locator('#kbSearch').fill('');
    await page.locator('#showEvidence').check();
    assert.equal(await page.locator('#kbGrid .kb-card').count(), 37);
    await page.locator('#showEvidence').uncheck();
    require('node:fs').mkdirSync('output/playwright', { recursive: true });
    await page.screenshot({ path: 'output/playwright/auth-library-desktop.png', fullPage: true });
    await page.locator('#kbBackHome').click();
    // 模型边界使用固定回答，验证提交、历史与消息渲染，不冒充真实模型评估。
    await page.route('**/api/chat', async route => {
      const body = route.request().postDataJSON();
      assert.ok(body.message.includes('精索静脉曲张'));
      await route.fulfill({ json: { reply: '模拟教学回答：精索静脉曲张是精索静脉异常扩张。', sources:[{id:'topic-vc',title:'曲张参考',references:[{title:'原始文献',url:'https://doi.org/10.1111/andr.12511'}]}] } });
    });
    await page.locator('#input').fill('请解释精索静脉曲张');
    await page.locator('#sendBtn').click();
    await page.getByText('模拟教学回答：精索静脉曲张是精索静脉异常扩张。', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('模拟教学回答：精索静脉曲张是精索静脉异常扩张。', { exact: true }).waitFor();
    assert.equal(await page.locator('.citation-strip a').getAttribute('href'),'https://doi.org/10.1111/andr.12511');
    await page.locator('#resetBtn').click();
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('andrology_chat_v1')),null);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('connectionStatus').textContent.includes('37 篇'));
    assert.equal(await page.getByText('模拟教学回答：精索静脉曲张是精索静脉异常扩张。', { exact: true }).count(),0);
    await page.route('**/api/chat', route => route.fulfill({ status: 500, json: { error: 'DeepSeek 接口错误 402：Insufficient Balance' } }));
    await page.locator('#input').fill('精索静脉曲张如何评估');
    await page.locator('#sendBtn').click();
    await page.getByText('模型服务账户余额不足，请充值或更换可用的模型服务密钥后重试。本地知识库仍可正常浏览。', { exact: true }).waitFor();
    // 失效缓存、取消后可主动重连。
    await page.evaluate(() => localStorage.setItem('andrology_token', 'expired'));
    await page.reload();
    await page.locator('#authCancel').click();
    await page.locator('#reconnectBtn').waitFor({ state: 'visible' });
    await page.locator('#reconnectBtn').click();
    await page.locator('#authInput').fill('ui-test-access');
    await page.locator('#authSubmit').click();
    await page.waitForFunction(() => document.getElementById('connectionStatus').textContent.includes('37 篇'));
    // 同时遇到 401 时共用一次输入。
    const concurrent = page.evaluate(async () => {
      clearToken();
      return (await Promise.all([apiGet('/api/modules'), apiGet('/api/reading')])).map(r => r.status);
    });
    await page.locator('#authInput').fill('ui-test-access');
    await page.locator('#authSubmit').click();
    assert.deepEqual(await concurrent, [200, 200]);
    await page.evaluate(() => { void openTeacherPage(); });
    await page.locator('#authInput').fill('wrong');
    await page.locator('#authSubmit').click();
    await page.locator('#authError').filter({ hasText: '口令' }).waitFor();
    await page.locator('#authInput').fill('ui-test-teacher');
    await page.locator('#authSubmit').click();
    await page.locator('#teacherStats .stat-card').first().waitFor();
    await page.evaluate(() => document.getElementById('teacherPage').hidden = true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#modulesBtn').click();
    await page.screenshot({ path: 'output/playwright/auth-library-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('PASS: 口令首次输入/错误重试/失效缓存/取消重连/并发鉴权/教师口令；37篇知识库、搜索正文、模拟问答、移动端。');
  } finally { await browser?.close(); server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
