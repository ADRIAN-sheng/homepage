// deploy-github.cjs — 用 GitHub REST API 一键部署（无需本机安装 git）
//
// 用法：
//   node deploy-github.cjs <仓库名>              ← Token 从文件读取
//   node deploy-github.cjs <仓库名> <token>      ← 或直接传 Token
//
// Token 读取顺序：E:\项目\个人\token.txt → 项目内 .deploy-token → 命令行参数
// 功能：创建仓库（已存在则复用）→ 上传全部文件 → 开启 Pages → 输出网址
"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");

const OWNER = "ADRIAN-sheng";
const ROOT = __dirname;

const repo = (process.argv[2] || "").trim();
let token = (process.argv[3] || "").trim();

if (!repo) {
  console.error("用法：node deploy-github.cjs <仓库名> [token]");
  process.exit(1);
}

if (!token) {
  const candidates = [
    "E:\\项目\\个人\\token.txt",
    path.join(ROOT, ".deploy-token")
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) { token = fs.readFileSync(p, "utf8").trim(); break; }
    } catch (e) { /* 继续尝试下一个 */ }
  }
}
if (!token) {
  // 兜底：扫描 E:\项目\个人 下所有 txt/md 文件，找 ghp_ 开头的 Token
  const dir = "E:\\项目\\个人";
  try {
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (!/\.(txt|md)$/i.test(name)) continue;
        const txt = fs.readFileSync(path.join(dir, name), "utf8");
        const m = txt.match(/ghp_[A-Za-z0-9]{30,}/);
        if (m) { token = m[0]; break; }
      }
    }
  } catch (e) { /* 扫描失败，继续 */ }
}
if (!token) {
  console.error("[X] 找不到 Token。请把 Token 存到 E:\\项目\\个人\\token.txt（或作为第二个参数传入）。");
  process.exit(1);
}

// 需要上传的文件（相对项目根目录）
const UPLOAD_FILES = [
  "index.html",
  "README.md",
  ".gitignore",
  "css/style.css",
  "js/content.js",
  "js/app.js",
  "deploy-github.cjs",
  "server.cjs",
  "smoke-test.cjs",
  "发布.cmd",
  "发布.ps1"
];

function api(method, apiPath, body) {
  return new Promise(function (resolve, reject) {
    const data = body ? Buffer.from(JSON.stringify(body), "utf8") : null;
    const headers = {
      "User-Agent": "zane-site-deploy",
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (data) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = data.length;
    }
    const req = https.request({
      hostname: "api.github.com",
      path: apiPath,
      method: method,
      headers: headers
    }, function (res) {
      let d = "";
      res.on("data", function (c) { d += c; });
      res.on("end", function () {
        let json = null;
        try { json = JSON.parse(d); } catch (e) { json = null; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(json || d);
        } else {
          const msg = json && json.message ? json.message : d.slice(0, 200);
          reject(new Error(res.statusCode + " " + msg));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// URL 编码路径各段（处理中文文件名）
function encPath(rel) {
  return rel.split("/").map(encodeURIComponent).join("/");
}

async function main() {
  console.log("目标：https://github.com/" + OWNER + "/" + repo);
  console.log("");

  // 1. 创建仓库（已存在则复用）
  let defaultBranch = "main";
  try {
    const r = await api("GET", "/repos/" + OWNER + "/" + repo);
    defaultBranch = r.default_branch || "main";
    console.log("[OK] 仓库已存在：" + repo + "（分支 " + defaultBranch + "）");
  } catch (e) {
    const r = await api("POST", "/user/repos", {
      name: repo,
      public: true,
      auto_init: true,
      description: "我的个人主页"
    });
    defaultBranch = r.default_branch || "main";
    console.log("[OK] 仓库已创建：" + repo + "（分支 " + defaultBranch + "）");
  }

  // 2. 上传文件
  for (const rel of UPLOAD_FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.log("[跳过] 本地不存在：" + rel);
      continue;
    }
    const content = fs.readFileSync(abs);
    const b64 = content.toString("base64");

    let sha = null;
    try {
      const existing = await api("GET",
        "/repos/" + OWNER + "/" + repo + "/contents/" + encPath(rel) + "?ref=" + encodeURIComponent(defaultBranch));
      sha = existing.sha;
    } catch (e) { /* 新文件，无 sha */ }

    const body = { message: "update " + rel, content: b64, branch: defaultBranch };
    if (sha) body.sha = sha;
    await api("PUT", "/repos/" + OWNER + "/" + repo + "/contents/" + encPath(rel), body);
    console.log("[OK] 已上传：" + rel + "（" + content.length + " 字节）");
  }

  // 3. 开启 Pages
  try {
    await api("POST", "/repos/" + OWNER + "/" + repo + "/pages", {
      source: { branch: defaultBranch, path: "/" }
    });
    console.log("[OK] Pages 已开启（分支 " + defaultBranch + "）");
  } catch (e) {
    console.log("[提示] Pages：" + e.message + "（若为 already exists 说明已开启，忽略）");
  }

  console.log("");
  console.log("==================================================");
  console.log("部署完成！页面地址：https://" + OWNER.toLowerCase() + ".github.io/" + repo + "/");
  console.log("首次构建约 1-2 分钟生效。");
  console.log("==================================================");
}

main().catch(function (e) {
  console.error("[X] 部署失败：" + e.message);
  process.exit(1);
});
