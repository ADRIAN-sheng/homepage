# 我的个人主页

线上地址：**https://adrian-sheng.github.io/homepage/**

一个零依赖的纯静态个人网页：**单页、两个标签页**。

- 「🌸 关于我」：点开就能看（个人信息 / 喜好 / 风格）
- 「💌 恋爱观点」：需要输入密码才能看（默认密码 `0922`）

所有文字、图片都集中在 `js/content.js` 里，改完刷新即可，不需要懂代码。

## 文件结构

```
personal-site/
├── index.html          # 页面骨架（一般不用动）
├── css/
│   └── style.css       # 样式/配色（想换风格改这里顶部变量）
├── js/
│   ├── content.js      # ★ 所有内容都改这里（文字、图片、密码哈希）
│   └── app.js          # 渲染 + 标签切换 + 密码解锁（一般不用动）
├── deploy-github.cjs   # 用 GitHub API 一键部署（无需本机 git）
├── 发布.cmd / 发布.ps1  # 备选：双击用本机 git 发布
├── server.cjs          # 本地预览服务器（node server.cjs）
├── smoke-test.cjs      # 自检脚本（node smoke-test.cjs）
└── README.md
```

## 一、本地预览

直接**双击 `index.html`**，浏览器就会打开，无需安装任何东西、无需服务器。

## 二、改内容

打开 `js/content.js`，每个字符串都能直接改：

- `site.title / subtitle / avatar / footer` —— 站点标题、副标题、头像、页脚
- `tabs[0]`（关于我）的 `sections` —— 个人信息 / 喜好 / 风格
- `tabs[1]`（恋爱观点）的 `sections` —— 你关于恋爱的看法

内容块支持三种类型：

| type | 用途 |
|------|------|
| `text` | 一段文字（支持换行，直接 `\n`） |
| `quote` | 引用/强调段落（左侧竖线 + 浅色底） |
| `list` | 列表（每行一条） |
| `kv` | 键值对（如「昵称 → xxx」） |
| `image` | 图片（现在留空，未来挂图） |

## 三、挂图片（未来）

在任意 `blocks` 里加一块：

```js
{ type: "image", url: "https://你的图床/照片.jpg", caption: "图注（可省略）" }
```

`url` 留空就**整块不显示**，所以现在不挂图完全没问题。图片可以放：

1. 免费图床（如 imgdb.cn、SM.MS 等），拿到直链填进去；
2. 或放进仓库（比如 `images/` 目录），url 填相对路径 `images/xx.jpg`。

## 四、改查看密码

默认密码是 `0922`。改法：算出新密码的 SHA-256，替换 `js/content.js` 里的 `lock.passwordHash`。

**方法 A（本机有 Node）：** 在项目目录运行，把 `你的新密码` 换掉：

```bash
node -e "console.log(require('crypto').createHash('sha256').update('你的新密码','utf8').digest('hex'))"
```

**方法 B（部署后，在浏览器控制台）：**

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('你的新密码'))
  .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
```

把输出的 64 位字符串填到 `passwordHash: "..."` 即可。

## 五、部署到 GitHub Pages（免费）

两种方式，二选一：

**方式 A（推荐）：AI 助手直接部署，无需装 git。**
生成 Token 后，AI 助手运行 `node deploy-github.cjs 仓库名`，脚本自动完成建仓库 → 上传文件 → 开启 Pages。Token 读取顺序：`E:\项目\个人\token.txt` → 项目内 `.deploy-token` → `E:\项目\个人` 下任意 txt/md 里的 `ghp_` 开头串 → 命令行第二个参数。以后每次改内容，也由助手重新运行脚本发布。

**方式 B：自己双击「发布.cmd」。** 按下面步骤操作一次（需要本机安装 Git），以后每次改完内容双击「发布.cmd」即可。

### 1. 建仓库（方式 B 需要）
登录 [github.com](https://github.com)（账号 `ADRIAN-sheng`）→ 右上角 `+` → New repository → 仓库名随意（如 `homepage`）→ **Public** → Create。

> 为什么选 Public：GitHub Pages 对公开仓库免费且最省事。注意本页面是「轻量版」密码——恋爱观点的文字其实都在 `content.js` 源码里，懂技术的人能绕过密码直接看，所以仓库公不公开都不影响这一层的强度（见文末「安全说明」）。

### 2. 生成 Token
GitHub 已禁用密码推送/接口操作。生成一个 Personal Access Token：
头像 → **Settings** → 左侧最下 **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)** → 勾选 **repo** → **Generate token** → 复制 `ghp_` 开头的那串（只显示一次）。

### 3. 双击「发布.cmd」一键推送（方式 B）
在本项目文件夹双击 **发布.cmd**：第一次运行输入仓库名；首次推送弹出登录框时**用户名填 `ADRIAN-sheng`，密码粘贴 Token**（不是账号密码）。成功一次后 Windows 会记住，以后双击即发布。

### 4. 开启 Pages
仓库 → **Settings** → **Pages** → Source 选 **Deploy from a branch** → Branch 选 `main` / `/ (root)` → **Save**。

稍等一两分钟，得到网址：`https://adrian-sheng.github.io/仓库名/`

### 5.（可选）绑定 .vip 域名
- 在 Pages 设置里填 **Custom domain**，如 `xxx.vip`，勾选 **Enforce HTTPS**；
- 到域名商 DNS 加一条 **CNAME 记录**，指向 `adrian-sheng.github.io`；
- 等 DNS 生效即可用 `https://xxx.vip` 访问。

> 注意：用国内服务器 + 自定义域名才需要 ICP 备案；GitHub Pages 是海外托管，不需要备案，但国内访问速度一般。

## 六、微信朋友圈分享

- 页面已做移动端适配，微信内打开没问题。
- 分享卡片：部署后把 `index.html` 里的 `og:title / og:description / og:image` 换成你的信息（`og:image` 填一张 ≥300×200 的图片直链，卡片才好看）。

## 七、AI 编辑 + 独立编辑密码（下一阶段）

思路（等 GitHub 就绪后做）：

- **内容都在 `js/content.js`**，AI 改这个文件就等于改内容。
- **编辑密码**和**查看密码**完全分开：编辑密码保护「谁能改」，走服务端/GitHub 校验，绝不放前端。
- 具体可做成：AI 用 Token 调 GitHub API 改 `content.js` → 自动触发 Pages 重新发布；或加一个 `/admin` 页面，用编辑密码登录后改内容。

## 安全说明

本页面采用**轻量版密码**：校验逻辑在前端，密码只以 SHA-256 哈希形式存在源码里（不存明文）。它的作用是「挡住普通朋友/访客」，但**不能**挡住懂技术的人（看源码即可绕过）。如果你的「恋爱观点」是真正敏感的内容，请把这一块改成服务端校验（下一阶段可升级）。
