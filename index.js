(async () => {
  const DELETE_DELAY_MS = 1200;
  const FETCH_DELAY_MS = 800;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const headers = { "Authorization": "", "Content-Type": "application/json" };

  async function req(method, path) {
    while (true) {
      const res = await fetch(`/api/v10${path}`, { method, headers });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const wait = (body.retry_after ?? 1) * 1000 + 250;
        log(`rate limited, waiting ${Math.round(wait)}ms`, "muted");
        await sleep(wait);
        continue;
      }
      if (res.status === 204) return null;
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    }
  }

  function parseChannelId(input) {
    const ids = String(input).match(/\d{17,20}/g);
    return ids ? ids[ids.length - 1] : null;
  }

  async function describeChannel(id) {
    const ch = await req("GET", `/channels/${id}`);
    if (ch.type === 1) {
      const u = ch.recipients?.[0];
      return u ? `DM with ${u.global_name || u.username} (@${u.username})` : `DM ${id}`;
    }
    if (ch.type === 3) {
      const names = (ch.recipients || []).map((u) => u.global_name || u.username).join(", ");
      return ch.name ? `Group "${ch.name}" (${names})` : `Group DM (${names})`;
    }
    return ch.name ? `#${ch.name}` : `Channel ${id}`;
  }

  function grabToken() {
    try {
      const f = document.createElement("iframe");
      f.style.display = "none";
      document.body.appendChild(f);
      const raw = f.contentWindow.localStorage?.token;
      f.remove();
      if (raw) return JSON.parse(raw);
    } catch {}
    try {
      let mods;
      window.webpackChunkdiscord_app.push([[Symbol()], {}, (r) => { mods = Object.values(r.c); }]);
      for (const m of mods) {
        const e = m?.exports;
        const g = e?.default?.getToken ?? e?.getToken ?? e?.Z?.getToken ?? e?.ZP?.getToken;
        if (typeof g === "function") { const t = g(); if (t) return t; }
      }
    } catch {}
    return null;
  }

  document.getElementById("dmc-panel")?.remove();
  const style = document.createElement("style");
  style.textContent = `
    #dmc-panel{position:fixed;top:24px;right:24px;width:368px;z-index:99999;
      background:#000;color:#fff;border:1px solid #262626;border-radius:16px;
      font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;
      box-shadow:0 16px 50px rgba(0,0,0,.7);overflow:hidden}
    #dmc-panel *{box-sizing:border-box;font-family:inherit}
    #dmc-panel header{display:flex;align-items:center;justify-content:space-between;
      padding:20px 22px;border-bottom:1px solid #1a1a1a}
    #dmc-panel header h1{margin:0;font-size:16px;font-weight:600;letter-spacing:-.01em}
    #dmc-panel header .x{cursor:pointer;color:#666;font-size:22px;line-height:1;
      width:28px;height:28px;display:flex;align-items:center;justify-content:center;
      border-radius:8px;transition:.15s}
    #dmc-panel header .x:hover{color:#fff;background:#1a1a1a}
    #dmc-body{padding:22px;display:flex;flex-direction:column;gap:22px}
    .dmc-field{display:flex;flex-direction:column;gap:10px}
    .dmc-field>label{font-size:11px;font-weight:600;color:#777;
      text-transform:uppercase;letter-spacing:.06em}
    #dmc-body input[type=text],#dmc-body input[type=number]{width:100%;
      background:#0e0e0e;border:1px solid #2a2a2a;color:#fff;border-radius:10px;
      padding:12px 14px;font-size:14px;transition:border-color .15s}
    #dmc-body input::placeholder{color:#555}
    #dmc-body input:focus{outline:none;border-color:#fff}
    #dmc-target{font-size:13px;color:#666;padding:2px}
    #dmc-target.ok{color:#fff}#dmc-target.err{color:#999}
    #dmc-status{display:flex;align-items:center;gap:10px;font-size:13px;color:#888}
    #dmc-status .dot{width:9px;height:9px;border-radius:50%;border:1.5px solid #555;flex:none}
    #dmc-status.on{color:#fff}#dmc-status.on .dot{background:#fff;border-color:#fff}
    .dmc-seg{display:flex;background:#0e0e0e;border:1px solid #2a2a2a;border-radius:11px;padding:4px;gap:4px}
    .dmc-seg button{flex:1;background:transparent;border:none;color:#888;padding:10px;
      border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:.15s}
    .dmc-seg button.active{background:#fff;color:#000}
    .dmc-switch{display:flex;align-items:center;gap:13px;cursor:pointer;user-select:none}
    .dmc-switch input{display:none}
    .dmc-switch .track{position:relative;width:42px;height:24px;background:#2a2a2a;
      border-radius:99px;transition:background .2s;flex:none}
    .dmc-switch .track::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;
      background:#777;border-radius:50%;transition:.2s}
    .dmc-switch input:checked + .track{background:#fff}
    .dmc-switch input:checked + .track::after{background:#000;transform:translateX(18px)}
    .dmc-switch span.lbl{font-size:14px;color:#ccc}
    #dmc-btn,#dmc-connect{width:100%;background:#fff;color:#000;border:none;border-radius:11px;
      padding:14px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s}
    #dmc-btn:hover,#dmc-connect:hover{opacity:.88}
    #dmc-btn:disabled{background:#1a1a1a;color:#555;cursor:default}
    #dmc-log{background:#0e0e0e;border:1px solid #1a1a1a;border-radius:11px;padding:13px;
      max-height:180px;overflow:auto;font-size:12px;line-height:1.6;
      white-space:pre-wrap;word-break:break-word;display:none;color:#aaa}
    #dmc-log .ok{color:#fff}#dmc-log .err{color:#999;text-decoration:line-through}
    #dmc-log .muted{color:#666}
    #dmc-token-wrap{display:flex;flex-direction:column;gap:14px}
    #dmc-confirm{position:absolute;inset:0;background:rgba(0,0,0,.88);backdrop-filter:blur(2px);
      display:none;align-items:center;justify-content:center;padding:22px;z-index:5}
    #dmc-confirm .card{width:100%;display:flex;flex-direction:column;gap:18px;text-align:center}
    #dmc-confirm h2{margin:0;font-size:17px;font-weight:600}
    #dmc-confirm p{margin:0;font-size:13.5px;color:#aaa;line-height:1.55}
    #dmc-confirm b{color:#fff;font-weight:600}
    #dmc-confirm .actions{display:flex;gap:10px;margin-top:4px}
    #dmc-confirm button{flex:1;padding:13px;border-radius:11px;font-size:14px;font-weight:600;
      cursor:pointer;border:none;transition:opacity .15s}
    #dmc-confirm button:hover{opacity:.85}
    #dmc-confirm .cancel{background:#1a1a1a;color:#fff}
    #dmc-confirm .go{background:#fff;color:#000}`;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.id = "dmc-panel";
  panel.innerHTML = `
    <header><h1>Message Cleaner</h1><span class="x" id="dmc-close">×</span></header>
    <div id="dmc-body">
      <div id="dmc-status"><span class="dot"></span><span id="dmc-status-text">Connecting…</span></div>
      <div id="dmc-token-wrap" style="display:none">
        <div class="dmc-field"><label>Token</label><input type="text" id="dmc-token" placeholder="Paste token"></div>
        <button id="dmc-connect">Connect</button>
      </div>
      <div id="dmc-main" style="display:none;flex-direction:column;gap:22px">
        <div class="dmc-field">
          <label>Channel</label>
          <input type="text" id="dmc-url" placeholder="https://discord.com/channels/@me/…">
          <div id="dmc-target">Paste a channel URL above.</div>
        </div>
        <div class="dmc-field">
          <label>Messages to delete</label>
          <div class="dmc-seg">
            <button class="active" data-mode="all">All</button>
            <button data-mode="num">Number</button>
          </div>
          <input type="number" id="dmc-count" min="1" placeholder="How many?" style="display:none">
        </div>
        <label class="dmc-switch">
          <input type="checkbox" id="dmc-dry" checked>
          <span class="track"></span>
          <span class="lbl">Test run — preview only</span>
        </label>
        <button id="dmc-btn" disabled>Start</button>
        <div id="dmc-log"></div>
      </div>
    </div>
    <div id="dmc-confirm"><div class="card">
      <h2>Delete messages?</h2>
      <p>You're about to permanently delete up to <b id="dmc-cf-count"></b> of your messages in <b id="dmc-cf-who"></b>.<br>This can't be undone.</p>
      <div class="actions">
        <button class="cancel" id="dmc-cf-cancel">Cancel</button>
        <button class="go" id="dmc-cf-go">Delete</button>
      </div>
    </div></div>`;
  document.body.appendChild(panel);

  const $ = (id) => document.getElementById(id);
  const logEl = $("dmc-log");

  function log(msg, cls = "") {
    logEl.style.display = "block";
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  $("dmc-close").onclick = () => { panel.remove(); style.remove(); };

  function confirmPurge(label, limitLabel) {
    return new Promise((resolve) => {
      $("dmc-cf-count").textContent = limitLabel;
      $("dmc-cf-who").textContent = label;
      const box = $("dmc-confirm");
      box.style.display = "flex";
      const done = (v) => { box.style.display = "none"; resolve(v); };
      $("dmc-cf-cancel").onclick = () => done(false);
      $("dmc-cf-go").onclick = () => done(true);
    });
  }

  const btn = $("dmc-btn");

  let deleteAll = true;
  panel.querySelectorAll(".dmc-seg button").forEach((b) => {
    b.onclick = () => {
      panel.querySelectorAll(".dmc-seg button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      deleteAll = b.dataset.mode === "all";
      $("dmc-count").style.display = deleteAll ? "none" : "block";
      if (deleteAll) $("dmc-count").value = "";
    };
  });

  let resolvedId = null, resolvedLabel = null, urlTimer;
  $("dmc-url").oninput = (e) => {
    clearTimeout(urlTimer);
    resolvedId = null; resolvedLabel = null; btn.disabled = true;
    const id = parseChannelId(e.target.value);
    const t = $("dmc-target");
    if (!id) { t.className = ""; t.textContent = "Paste a channel URL above."; return; }
    t.className = ""; t.textContent = "Resolving…";
    urlTimer = setTimeout(async () => {
      try {
        const label = await describeChannel(id);
        resolvedId = id; resolvedLabel = label;
        t.className = "ok"; t.textContent = "✓ " + label;
        btn.disabled = false;
      } catch {
        t.className = "err"; t.textContent = "Couldn't access that channel.";
      }
    }, 400);
  };

  async function purge(channelId, myId, label, limit, dry) {
    log(`=== ${label} ===`);
    let before = null, deleted = 0, scanned = 0;
    outer: while (deleted < limit) {
      const q = before ? `?limit=100&before=${before}` : `?limit=100`;
      const messages = await req("GET", `/channels/${channelId}/messages${q}`);
      if (!messages.length) break;
      before = messages[messages.length - 1].id;
      for (const m of messages) {
        scanned++;
        if (m.author.id !== myId) continue;
        if (deleted >= limit) break outer;
        const preview = (m.content || "[embed/attachment]").slice(0, 50).replace(/\n/g, " ");
        if (dry) {
          deleted++;
          log(`[preview ${deleted}] ${preview}`, "muted");
        } else {
          try {
            await req("DELETE", `/channels/${channelId}/messages/${m.id}`);
            deleted++;
            log(`✓ ${deleted}: ${preview}`, "ok");
          } catch (e) {
            log(`✗ failed: ${preview}`, "err");
          }
          await sleep(DELETE_DELAY_MS);
        }
      }
      await sleep(FETCH_DELAY_MS);
    }
    log(`${dry ? "Would delete" : "Deleted"} ${deleted} (scanned ${scanned}).`, "ok");
    return deleted;
  }

  let myId = null;
  btn.onclick = async () => {
    if (!resolvedId) return;
    const dry = $("dmc-dry").checked;
    const limit = deleteAll ? Infinity : Math.max(1, parseInt($("dmc-count").value, 10) || 0);
    if (!deleteAll && !limit) { log("Enter a valid number.", "err"); return; }
    const limitLabel = limit === Infinity ? "all" : limit;

    if (!dry) {
      const ok = await confirmPurge(resolvedLabel, limitLabel);
      if (!ok) { log("Cancelled.", "muted"); return; }
    }

    btn.disabled = true;
    btn.textContent = "Working…";
    logEl.innerHTML = "";
    log(`Mode: ${dry ? "DRY RUN" : "LIVE DELETE"} · limit ${limitLabel}`);
    const start = Date.now();
    try {
      const n = await purge(resolvedId, myId, resolvedLabel, limit, dry);
      const secs = ((Date.now() - start) / 1000).toFixed(1);
      log(`Done — ${dry ? "would delete" : "deleted"} ${n} in ${secs}s.`, "ok");
    } catch (e) {
      log(`Error: ${e.message}`, "err");
    }
    btn.disabled = false;
    btn.textContent = "Start";
  };

  async function authenticate(token) {
    headers.Authorization = token;
    const me = await req("GET", "/users/@me");
    myId = me.id;
    $("dmc-status-text").textContent = `Connected as ${me.username}`;
    $("dmc-status").classList.add("on");
    $("dmc-token-wrap").style.display = "none";
    $("dmc-main").style.display = "flex";

    if (parseChannelId(window.location.href)) {
      $("dmc-url").value = window.location.href;
      $("dmc-url").dispatchEvent(new Event("input"));
    }
  }

  function showTokenField() {
    $("dmc-status-text").textContent = "Couldn't auto-detect — paste a token:";
    $("dmc-token-wrap").style.display = "block";
    $("dmc-connect").onclick = async () => {
      const t = $("dmc-token").value.trim();
      if (!t) return;
      try { await authenticate(t); }
      catch { $("dmc-status-text").textContent = "That token didn't work."; }
    };
  }

  const auto = grabToken();
  if (auto) {
    try { await authenticate(auto); }
    catch { showTokenField(); }
  } else {
    showTokenField();
  }
})();
