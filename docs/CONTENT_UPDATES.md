# v0.5 content updates

## 已确认的维护约定（2026-10-02）

- 图鉴首次差异保留本地、一致字段后续跟随云端、新武学追加的规则与离线报告
  命令统一记录在 [ENCYCLOPEDIA_SYNC.md](ENCYCLOPEDIA_SYNC.md)。四类图鉴已接入
  阿里云定时发布；副本保持手动维护，装备未绑定来源。
- 阿里云是线上数据的主要存放位置和客户端第一优先更新源：
  `https://47.95.250.113/jianghu/`，服务器目录为
  `/opt/jianghu-calculator/releases/`。本地源文件及 Git 用于编辑、追溯和备份。
- 备用顺序为 GitHub Pages、jsDelivr、raw GitHub。正式网页地址固定为
  `https://flashba.github.io/jianghu-calculator/`，网页和 APK 共用内容数据。
- 每次手动发布数据，同步阿里云、GitHub main 和正式网页所需文件，并确认
  Pages 部署成功；不要只更新本地或开发分支。兼容 v0.4 期间还要同步独立
  JSON 文件（包括图鉴、更新日志及有改动的旧攻略文件）。
- 腾讯文档定时任务绑定“游玩注意事项”及随从、技艺、内功、武学，每天检查一次，
  自动发布到阿里云；它不会自动推送 GitHub，也不会同步所有腾讯文档。
  手动发布完整包前须合并服务器最新内容并使用发布锁，避免覆盖定时更新。
- “检查数据更新”必须显示检查结果：检查中、数据更新成功、数据已是最新，
  或更新失败且保留当前数据。提示位于首页按钮旁，不弹安装提示。
  启动时可能已经自动更新，因此之后手动检查显示“数据已是最新”是正常的。
  此结果比较的是已发布数据包，不代表实时检查了腾讯文档。
- v0.5 支持通过数据包新增攻略目录项及文字、表格内容，无需重新安装 APK。
  新帖子必须先整理进入 `strategy_guides.json` 并发布新数据包，不会自动抓取
  任意新帖子。保持旧 ID 不变，新帖子使用唯一 ID，内容提取为文字而非贴图。
- 新页面交互、未支持的内容结构、计算规则或原生功能变更仍需要客户端更新；
  网页同步发布对应代码。v0.4 用户需要先升级一次 v0.5，才能获得完整内容包更新能力。
- 数据版本和 APK 版本独立。纯数据更新不打包 APK，不修改 `latest.json`，
  不触发应用安装公告。APK 发布须另外核对签名、版本号和正式更新清单。

The v0.5 client checks `content_manifest_v2.json` and downloads only changed,
SHA-256-addressed files under `content-parts/`. Eight parts separate encyclopedia,
dungeons, pitfalls, guide directory/lineups, original search, recipes, extracted
strategy text, and update logs. Android still ships a complete encrypted offline
copy in `app.vault`. No remote JavaScript is loaded.
APK version codes and content revisions are independent.

## 分包更新（2026-10-02）

- 完整包继续作为首次启动/离线内置数据及旧客户端兼容文件；后续只下载哈希改变的分包。
- 客户端每次最多并发下载 3 个分包。一次检查内，切换备用源会复用已校验的分包。
- 所有需要的分包下载、校验及组装成功后，以同一个 IndexedDB 事务覆盖 `current`；失败不更新任何正在使用的数据。
- 技艺文案和计算属性同属图鉴包。分包是传输优化，手机仍只保留一套最新数据缓存。
- 网页有有效缓存后不再每次打开就下载完整包。首次访问仍需获取全部内容。
- 清单约 1.6 KB 未压缩；当前 gzip 估算：图鉴 17 KB、副本 6.7 KB、避坑 3 KB、其他攻略 10.6 KB、原版检索 190 KB、菜谱 0.5 KB、攻略提取文本 5.9 KB、日志 19 KB。不含 HTTP/TLS 开销。
- 定时发布器和手动构建共用 `tools/content_parts.py`。先写不可变分包，再写完整兼容包及 v1 清单，最后写 v2 清单。不能只上传清单，不上传它引用的文件。
- 保留旧哈希文件，允许已取得旧清单的请求完成；服务器分包文件不属于手机缓存。GitHub 备用源也须同步分包文件与 v2 清单。
- 数据地址仍为阿里云优先；以后迁往 OSS/CDN 可沿用相同格式，但当前并未迁移。

## Editable sources

| File under `web/` | Content |
| --- | --- |
| `whiterabbit_data.json` | Encyclopedia and calculator values, dungeon drops |
| `wiki_content.json` | Version notes, 31 confirmed lineups, statistics |
| `tencent_pitfalls.json` | Generated full text from the bound Tencent pitfalls sheet |
| `strategy_guides.json` | Guide directory metadata and structured sections |
| `guide_search_index.json` | Original guide search chunks |
| `strategy_ocr_data.json` | Extracted strategy text |
| `tencent_recipe_data.json` | Recipes |
| `update_logs.json` | Game update logs |

Keep existing guide and chunk IDs stable to preserve favorites. Add a guide to
`strategy_guides.json` with a unique `id`, `title`, optional `author`, `summary`,
`icon`, `tone`, and `sections`. Text sections use `type: "text"`, `id`, `title`,
and `text`. They appear in the directory automatically. Image section records
remain legacy keys for existing text renderers; they do not download images.
New layouts or calculation rules still require a client release.

`guide-directory-data.js` and `new-ui-reference/wiki-data.js` are legacy reference
files and are no longer v0.5 runtime sources.

## Build and publish content

The pitfalls guide is bound to document `DSWJSVEVGc1Z6Q21E`, sheet `jnxb02`
(`游玩注意事项`). Do not edit its text manually or copy another guide into it.
Run `node tools/build-content-bundle.cjs --sync-sources` to fetch that sheet and
build the complete client bundle in one command. A fetch or parse error stops
the command before replacing current content. For inspection only, use
`python3 tools/sync_tencent_pitfalls.py --check`.

The synchronizer resolves both plain and rich text by cell coordinates and
requires complete, consecutive item numbers. It replaces the source snapshot,
so additions, edits, and deletions follow the sheet. If the sheet grows beyond
the supported fetch window or changes layout, it fails rather than publishing
a partial guide. Unchanged text preserves the previous verified snapshot and
its timestamp/revision; the command reports the revision checked this time.
The builder moves the source warning containing 武道感悟 and 不要直接使用 to
the top and adds the existing red warning. Every body remains unabridged; it
keeps original item labels and cell references. No other-source advice is mixed
in. Favorites retain the existing `guide:pitfalls` ID.

Clients check our published content bundle, not Tencent Docs directly. This
command is the extraction step for manual publishing.

### Aliyun daily synchronization

`jianghu-pitfalls-sync.timer` runs daily at 04:00 Asia/Shanghai on Aliyun.
`jianghu-encyclopedia-sync.timer` runs daily at 04:10 Asia/Shanghai. It uses the
same publication lock and preserves every category outside its four owned arrays.
See `ENCYCLOPEDIA_SYNC.md` for baseline protection and technique calculation rules.
The job and private status/backup files live under `/opt/jianghu-content-sync`.
`publish_tencent_pitfalls.py` reads the CURRENT public content bundle and patches
only its bound pitfalls data. It checks the existing manifest checksum first,
rejects old source revisions, saves the previous pair outside the public root,
replaces the bundle, and publishes its new manifest last. No content change means
no new content revision. Failures are recorded by systemd and retried next run.
The timer does not build APKs or change `latest.json`.

Useful server commands:

```sh
jianghu-check-updates
jianghu-check-updates --check-only
systemctl list-timers jianghu-pitfalls-sync.timer
systemctl start jianghu-pitfalls-sync.service
journalctl -u jianghu-pitfalls-sync.service -n 30
cat /opt/jianghu-content-sync/status.json
```

`jianghu-check-updates` immediately runs the same server job used by the timer,
waits for completion, and prints whether content was published. `--check-only`
fetches and compares without changing published data. From a local terminal use
`ssh root@47.95.250.113 jianghu-check-updates`. These check pitfalls and the four
encyclopedia categories. `--encyclopedia` checks only those four categories.
Dungeon drops remain manual. The command never builds an APK.

The v0.5 bundle endpoint is live on Aliyun. Legacy v0.4 guide pages do not use this bundle. Publishing
v0.5 web/APK clients together is required to deliver this binding to all users.
The server does not have GitHub write credentials: timed changes currently
publish to Aliyun only. Both v0.5 clients use that same primary source, while
GitHub fallback snapshots require synchronization during a release. Before
publishing a new full bundle, re-fetch the bound source and coordinate with the
server's `/opt/jianghu-content-sync/publish.lock` to avoid overwriting a timed update.

1. Edit and review the source JSON. Tencent extraction is a separate workflow;
   do not publish unverified extraction automatically.
2. Run `node tools/build-content-bundle.cjs` from the repository root (Node and Python 3 required). It validates
   the sources, generates the complete bundle, both manifests and immutable parts,
   and advances the content revision only when source content changes.
3. Run `node tools/build-content-bundle.cjs --check`. Both Pages and APK CI require
   this check, preventing forgotten bundle regeneration.
4. After publication is authorized, upload all referenced `content-parts/` files first, then the bundle to a temporary filename
   under `/opt/jianghu-calculator/releases/`, then atomically rename it to
   `content_bundle.json`. Upload and atomically rename the v1 manifest, then `content_manifest_v2.json` LAST.
   Keep the previous pair in a backup directory outside the public download root.
5. Publish the exact same generated files to GitHub `main` and wait for Pages
   deployment. Pushing only a development branch does not update fallback URLs.
6. Fetch the live manifest and bundle using HTTPS, compare SHA-256 and revision,
   then test the manual button and restart offline on a v0.5 client.

The v0.4 client still reads `whiterabbit_data.json`. Publish that file to Aliyun
and GitHub `main` alongside the new bundle while supporting v0.4. Do not change
`latest.json` for content-only releases: it controls APK installation prompts.
To correct an already published bundle, edit the sources and generate a NEWER
revision; clients intentionally reject older content.

## Client behavior

- Load the valid cached copy, or the bundled copy on a first launch. Automatic checks
  on startup/foreground run at most once every 24 hours. The last attempt persists
  across launches, including failures; manual checks remain available immediately.
- Native APK checks also run at most once every 24 hours using persistent preferences.
- Home has a manual check button with checking, current, updated, and failure
  states. Simultaneous checks share one request sequence.
- Sources: Aliyun HTTPS, GitHub Pages, jsDelivr `main`, raw GitHub `main`.
- Manifest timeout: 15 seconds per source. Each changed part timeout: 40 seconds per source.
  Abort timed-out fetches, including body reads, before trying the next source.
- A reachable older manifest is not a network failure. If all reachable sources
  are older, show that local data is newer and retain it. If a newer bundle was
  found but failed to download or validate, still report failure.
- Require supported schema, a newer integer revision, valid data structure,
  matching manifest/bundle revision, and SHA-256 before writing IndexedDB.
- Save the entire bundle in one transaction before switching encyclopedia,
  calculator, and guides. Storage/network/validation errors retain old content.
- Favorites, teams, and achievements keep their existing localStorage keys.
- No new APK is required for content edits within this schema after installing
  the v0.5 client. Existing v0.4 installations need the initial v0.5 APK upgrade.

## Verification

Install `jsdom` and `fake-indexeddb` in a disposable external npm prefix, then run
`NODE_PATH=<prefix>/node_modules node tools/test-content-updates.cjs`.
The integration test covers actual client scripts, remote fallback/timeout,
new guides, calculator data, offline cache, favorites, invalid content, storage
failure, old revisions, and duplicate clicks. Actual Android WebView and release
signing/install verification remain required before the v0.5 APK release.

Content-only publishing does not publish an APK or release announcement.
