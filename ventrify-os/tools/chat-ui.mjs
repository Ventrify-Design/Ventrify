import puppeteer from '/Users/antonywhenman/Desktop/Ventrify/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
// Opens the Assist panel the way an operator does — from the utility rail — and sends a message.
// Exists because the first version of this panel could not send at all: listeners were attached only on
// repaint, so the FIRST open had nothing listening. Testing the component in isolation missed it entirely.
// Run against the demo server on :3200.
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--no-sandbox'] });
let fails = 0; const ok = (c,m) => { if(!c) fails++; console.log((c?'  PASS  ':'  FAIL  ')+m); };

for (const w of [1280, 390]) {
  const p = await b.newPage();
  let sent = null;
  await p.setRequestInterception(true);
  p.on('request', r => {
    // The demo build has no Firebase, so the dynamic import at send time has no currentUser to get a token
    // from. Stub the module so the test exercises the real send path rather than stopping at auth.
    if (r.url().includes('/firebase/firebase.js')) {
      return r.respond({ status:200, contentType:'text/javascript',
        body: 'export const auth = { currentUser: { getIdToken: async () => "test-token" } };' });
    }
    if (r.url().includes('/api/memo')) {
      sent = JSON.parse(r.postData() || '{}');
      return r.respond({ status:200, contentType:'application/json', body: JSON.stringify({
        ok:true, id:'x', text:'The recommendation is Diligence further [[verdict]].',
        cited:['verdict'], invalid:[], unsupportedFigures:[], proposals:[], stub:false, dropped:[] }) });
    }
    r.continue();
  });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message||e)));
  await p.setViewport({ width:w, height:900 });
  await p.goto('http://localhost:3200/workspace/assess-next.html?id=prg-07', { waitUntil:'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2600));

  console.log(`\n── ${w}px`);
  const rail = await p.evaluate(() => {
    const btn = document.querySelector('[data-panel="assist"]');
    if (!btn) return null; btn.click(); return true;
  });
  ok(rail, 'Assist button exists in the utility rail and was clicked');
  await new Promise(r => setTimeout(r, 700));

  ok(await p.$('#chat-input') !== null, 'composer rendered on FIRST open');
  ok(await p.$('#chat-send') !== null, 'send button rendered on first open');

  await p.type('#chat-input', 'What is the recommendation?');
  await p.click('#chat-send');
  await new Promise(r => setTimeout(r, 900));
  ok(sent !== null, 'clicking send actually fires the request' + (sent ? ` (q: "${sent.question}")` : ''));
  ok(sent && sent.action === 'chat' && sent.engagementId, 'request carries action + engagementId');

  const painted = await p.evaluate(() => {
    const t = document.querySelector('.chat-log') ? document.querySelector('.chat-log').textContent : '';
    return { user: t.includes('What is the recommendation?'), reply: t.includes('Diligence further'),
             chip: !!document.querySelector('.chat-chip'), ref: !!document.querySelector('.chat-ref') };
  });
  ok(painted.user, 'the question is shown back');
  ok(painted.reply, 'the reply is painted');
  ok(painted.chip && painted.ref, 'citations rendered as a numbered ref + chip');

  // Enter-to-send, on the second turn, after a repaint
  sent = null;
  await p.type('#chat-input', 'And the risk?');
  await p.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 900));
  ok(sent !== null, 'Enter sends after a repaint (delegation survives re-render)');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0,2).join(' | ') : ''));
  await p.close();
}
console.log(fails ? `\n${fails} FAILED\n` : '\nALL PASS\n');
await b.close(); process.exit(fails?1:0);
