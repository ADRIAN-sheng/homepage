(function () {
  "use strict";

  const C = window.SITE_CONTENT;
  if (!C) { console.error("content.js 未加载，请检查文件路径。"); return; }

  /* ---------------- 纯 JS 版 SHA-256（UTF-8 安全，零依赖） ---------------- */
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Hex(bytes) {
    const len = bytes.length;
    const bitLenHi = Math.floor((len * 8) / 0x100000000);
    const bitLenLo = (len * 8) >>> 0;
    const paddedLen = (((len + 8) >> 6) + 1) << 6;
    const padded = new Uint8Array(paddedLen);
    padded.set(bytes);
    padded[len] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(paddedLen - 8, bitLenHi >>> 0, false);
    dv.setUint32(paddedLen - 4, bitLenLo >>> 0, false);

    const h = H0.slice();
    const w = new Uint32Array(64);
    for (let i = 0; i < paddedLen; i += 64) {
      for (let t = 0; t < 16; t++) {
        w[t] = (padded[i + t * 4] << 24) | (padded[i + t * 4 + 1] << 16) |
               (padded[i + t * 4 + 2] << 8) | padded[i + t * 4 + 3];
      }
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return h.map(function (x) { return x.toString(16).padStart(8, "0"); }).join("");
  }

  function passwordMatches(input) {
    const bytes = new TextEncoder().encode(input);
    return sha256Hex(bytes) === C.lock.passwordHash;
  }

  /* ---------------- 解锁状态（localStorage 记住） ---------------- */
  function isUnlocked(tabId) {
    try { return localStorage.getItem(C.lock.storageKey + ":" + tabId) === "1"; }
    catch (e) { return false; }
  }
  function setUnlocked(tabId) {
    try { localStorage.setItem(C.lock.storageKey + ":" + tabId, "1"); } catch (e) {}
  }

  /* ---------------- 渲染 ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  // 支持 **加粗** 的内联格式：先转义再替换，安全且简单
  function renderInline(s) {
    return escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  function renderBlock(block) {
    const el = document.createElement("div");
    el.className = "block";

    if (block.type === "kv") {
      el.classList.add("block-kv");
      (block.items || []).forEach(function (item) {
        const row = document.createElement("div");
        row.className = "kv-row";
        const k = document.createElement("span"); k.className = "kv-k"; k.textContent = item.k;
        const v = document.createElement("span"); v.className = "kv-v"; v.innerHTML = renderInline(item.v);
        row.appendChild(k); row.appendChild(v);
        el.appendChild(row);
      });
    } else if (block.type === "list") {
      el.classList.add("block-list");
      const ul = document.createElement("ul");
      (block.items || []).forEach(function (t) {
        const li = document.createElement("li"); li.innerHTML = renderInline(t); ul.appendChild(li);
      });
      el.appendChild(ul);
    } else if (block.type === "text") {
      el.classList.add("block-text");
      el.innerHTML = renderInline(block.text || "");
    } else if (block.type === "quote") {
      el.classList.add("block-quote");
      el.innerHTML = renderInline(block.text || "");
    } else if (block.type === "image") {
      if (!block.url) return null;      // 没填 url 就整块不渲染
      el.classList.add("block-image");
      const img = document.createElement("img");
      img.src = block.url;
      img.alt = block.caption || "";
      img.loading = "lazy";
      el.appendChild(img);
      if (block.caption) {
        const cap = document.createElement("div");
        cap.className = "block-caption"; cap.textContent = block.caption;
        el.appendChild(cap);
      }
    } else {
      return null;
    }
    return el;
  }

  function renderSections(panel, tab) {
    panel.innerHTML = "";
    (tab.sections || []).forEach(function (section) {
      const sec = document.createElement("section");
      sec.className = "card";
      if (section.title) {
        const title = document.createElement("h2");
        title.className = "card-title"; title.textContent = section.title;
        sec.appendChild(title);
      }
      (section.blocks || []).forEach(function (block) {
        const el = renderBlock(block);
        if (el) sec.appendChild(el);
      });
      panel.appendChild(sec);
    });
  }

  function renderLocked(panel, tab) {
    panel.innerHTML = "";
    const card = document.createElement("section");
    card.className = "card lock-card";
    const emoji = document.createElement("div");
    emoji.className = "lock-emoji"; emoji.textContent = "🔒";
    const text = document.createElement("p");
    text.className = "lock-text"; text.textContent = "这部分内容需要密码才能查看";
    const btn = document.createElement("button");
    btn.className = "btn btn-primary"; btn.textContent = "输入密码解锁";
    btn.addEventListener("click", function () { openModal(tab.id); });
    card.appendChild(emoji); card.appendChild(text); card.appendChild(btn);
    panel.appendChild(card);
  }

  /* ---------------- 标签切换 ---------------- */
  function selectTab(tabId) {
    const tab = C.tabs.find(function (t) { return t.id === tabId; });
    if (!tab) return;
    if (tab.locked && !isUnlocked(tab.id)) {
      openModal(tab.id);
      return;
    }
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });
    document.querySelectorAll(".panel").forEach(function (p) {
      p.classList.toggle("active", p.dataset.tab === tabId);
    });
  }

  /* ---------------- 密码弹窗 ---------------- */
  let pendingTabId = null;
  const modal = document.getElementById("modal");
  const pwInput = document.getElementById("pwInput");
  const pwError = document.getElementById("pwError");

  function openModal(tabId) {
    pendingTabId = tabId;
    pwInput.value = "";
    pwError.hidden = true;
    modal.hidden = false;
    setTimeout(function () { pwInput.focus(); }, 50);
  }
  function closeModal() {
    modal.hidden = true;
    pendingTabId = null;
  }
  function submitPassword() {
    if (!pendingTabId) return;
    if (passwordMatches(pwInput.value)) {
      setUnlocked(pendingTabId);
      const tab = C.tabs.find(function (t) { return t.id === pendingTabId; });
      renderSections(document.getElementById("panel-" + pendingTabId), tab);
      closeModal();
      selectTab(pendingTabId);
    } else {
      pwError.hidden = false;
      pwInput.select();
    }
  }

  document.getElementById("pwOk").addEventListener("click", submitPassword);
  document.getElementById("pwCancel").addEventListener("click", closeModal);
  pwInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submitPassword(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

  /* ---------------- 初始化 ---------------- */
  function init() {
    document.getElementById("siteTitle").textContent = C.site.title;
    document.getElementById("siteSubtitle").textContent = C.site.subtitle;
    document.getElementById("siteFooter").textContent = C.site.footer;

    const avatar = document.getElementById("avatar");
    if (C.site.avatar) {
      const img = document.createElement("img");
      img.src = C.site.avatar; img.alt = "头像";
      avatar.appendChild(img);
    } else {
      avatar.style.display = "none";
    }

    const tabBar = document.getElementById("tabBar");
    const panels = document.getElementById("panels");
    C.tabs.forEach(function (tab, i) {
      const btn = document.createElement("button");
      btn.className = "tab-btn" + (i === 0 ? " active" : "");
      btn.dataset.tab = tab.id;
      btn.setAttribute("role", "tab");
      btn.innerHTML = '<span class="tab-icon">' + tab.icon + '</span><span>' + tab.label + '</span>' +
        (tab.locked ? '<span class="lock-badge">🔒</span>' : '');
      btn.addEventListener("click", function () { selectTab(tab.id); });
      tabBar.appendChild(btn);

      const panel = document.createElement("div");
      panel.className = "panel" + (i === 0 ? " active" : "");
      panel.id = "panel-" + tab.id;
      panel.dataset.tab = tab.id;
      panel.setAttribute("role", "tabpanel");
      panels.appendChild(panel);

      if (tab.locked && !isUnlocked(tab.id)) {
        renderLocked(panel, tab);
      } else {
        renderSections(panel, tab);
      }
    });
  }

  init();
})();
