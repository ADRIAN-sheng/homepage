// 冒烟测试：用最小假 DOM 跑通渲染 + 密码解锁流程，验证 SHA-256 正确性。
// 运行：node smoke-test.cjs
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const DIR = __dirname;
const contentSrc = fs.readFileSync(path.join(DIR, "js", "content.js"), "utf8");
const appSrc = fs.readFileSync(path.join(DIR, "js", "app.js"), "utf8");

const DEFAULT_HASH = "207fd47ed6a8671043e9f79626bb8826c1d306f0ca5ac300e10d53094fe206d0";

function runCase(contentSource, opts) {
  const allElements = [];
  const byId = {};

  class FakeEl {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this._classes = new Set();
      this._listeners = {};
      this._innerHTML = "";
      this.dataset = {};
      this.style = {};
      this.hidden = false;
      this.value = "";
      this.alt = "";
      this.src = "";
      this.loading = "";
      this.textContent = "";
      allElements.push(this);
    }
    get className() { return Array.from(this._classes).join(" "); }
    set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(v) { this._innerHTML = v; if (v === "") this.children = []; }
    appendChild(c) { this.children.push(c); return c; }
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
    setAttribute(k, v) { this[k] = v; }
    focus() {}
    select() {}
    get classList() {
      const self = this;
      return {
        add: (...cs) => cs.forEach(c => self._classes.add(c)),
        remove: (...cs) => cs.forEach(c => self._classes.delete(c)),
        contains: c => self._classes.has(c),
        toggle: (c, force) => {
          if (force === undefined) { self._classes.has(c) ? self._classes.delete(c) : self._classes.add(c); }
          else if (force) self._classes.add(c); else self._classes.delete(c);
        }
      };
    }
  }

  function findAll(root, pred) {
    const out = [];
    (function walk(el) {
      if (pred(el)) out.push(el);
      (el.children || []).forEach(walk);
    })(root);
    return out;
  }

  function getElementById(id) {
    if (byId[id]) return byId[id];
    const found = allElements.find(el => el.id === id);
    if (found) { byId[id] = found; return found; }
    const el = new FakeEl("div");
    el.id = id;
    byId[id] = el;
    return el;
  }
  const document = {
    getElementById,
    createElement: tag => new FakeEl(tag),
    querySelectorAll: sel => allElements.filter(el => {
      if (sel === ".tab-btn") return el._classes.has("tab-btn");
      if (sel === ".panel") return el._classes.has("panel");
      return false;
    })
  };

  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  };

  const window = { document, localStorage };

  // 在函数作用域内 eval，让 content.js / app.js 能看到上面的假 DOM
  eval(contentSource);
  eval(appSrc);

  assert.ok(window.SITE_CONTENT, "SITE_CONTENT 已挂到 window");
  assert.strictEqual(window.SITE_CONTENT.tabs.length, 2, "两个标签页");

  const tabBar = getElementById("tabBar");
  const panels = getElementById("panels");
  assert.strictEqual(tabBar.children.length, 2, "两个标签按钮");
  assert.strictEqual(panels.children.length, 2, "两个面板");

  const aboutPanel = panels.children.find(el => el.id === "panel-about");
  const lovePanel = panels.children.find(el => el.id === "panel-love");
  assert.ok(aboutPanel && aboutPanel.children.length >= 1, "关于我面板有卡片");
  aboutPanel.children.forEach(c => assert.ok(c._classes.has("card"), "关于我面板子项是 card"));
  const aboutBold = findAll(aboutPanel, el => el.tagName === "li" && String(el.innerHTML).includes("<strong>"));
  assert.ok(aboutBold.length >= 1, "通用区列表项加粗生效");
  assert.ok(lovePanel && lovePanel.children.length === 1 && lovePanel.children[0]._classes.has("lock-card"),
    "恋爱观点初始显示锁定卡片");

  // 密码流程：模拟真实交互——先点锁卡片上的“输入密码解锁”按钮，弹出密码框
  const unlockBtn = lovePanel.children[0].children[2];
  assert.ok(unlockBtn && unlockBtn._listeners["click"], "锁定卡片上有解锁按钮");
  unlockBtn._listeners["click"][0]();               // openModal("love")

  const modal = getElementById("modal");
  assert.ok(modal.hidden === false, "点击解锁后弹窗出现");

  const pwInput = getElementById("pwInput");
  const pwOk = getElementById("pwOk");
  const pwError = getElementById("pwError");
  pwError.hidden = true;                             // 与 index.html 中 hidden 属性一致

  // 先试错误密码
  pwInput.value = opts.wrongPassword;
  pwOk._listeners["click"][0]();
  assert.ok(pwError.hidden === false, "错误密码提示出现");
  assert.ok(lovePanel.children[0] && lovePanel.children[0]._classes.has("lock-card"), "错误密码后仍锁定");

  // 再试正确密码
  pwInput.value = opts.correctPassword;
  pwOk._listeners["click"][0]();
  assert.ok(store["my_site_unlocked:love"] === "1", "解锁状态已写入 localStorage");
  assert.ok(modal.hidden === true, "解锁后弹窗关闭");
  const first = lovePanel.children[0];
  assert.ok(!(first && first._classes.has("lock-card")), "正确密码后锁定卡片被替换");
  assert.ok(lovePanel.children.length >= 1, "恋爱观点渲染出内容卡片");
  lovePanel.children.forEach(c => assert.ok(c._classes.has("card"), "解锁后子项是 card"));
  const loveBold = findAll(lovePanel, el => String(el.innerHTML || "").includes("<strong>"));
  assert.ok(loveBold.length >= 1, "相亲区加粗生效（含引用块）");
  const loveLink = findAll(lovePanel, el => el.tagName === "a");
  assert.ok(loveLink.length >= 1, "契合度测试链接存在");

  return { window, byId, store, allElements };
}

// ===== 用例 1：默认密码 0922（嵌入的哈希必须等于 node 算出的哈希） =====
assert.strictEqual(
  crypto.createHash("sha256").update("0922", "utf8").digest("hex"),
  DEFAULT_HASH,
  "嵌入的默认哈希等于 node 对 0922 的 SHA-256"
);
runCase(contentSrc, { wrongPassword: "wrong", correctPassword: "0922" });
console.log("✓ 用例 1 通过：默认密码 0922 解锁成功");

// ===== 用例 2：中文/UTF-8 密码，验证 UTF-8 处理 =====
const CN_PW = "恋爱观点abc";
const cnHash = crypto.createHash("sha256").update(CN_PW, "utf8").digest("hex");
const contentSrc2 = contentSrc.replace(DEFAULT_HASH, cnHash);
runCase(contentSrc2, { wrongPassword: "不对的密码", correctPassword: CN_PW });
console.log("✓ 用例 2 通过：中文密码「" + CN_PW + "」解锁成功（UTF-8 正确）");

console.log("\n全部冒烟测试通过 ✅");
