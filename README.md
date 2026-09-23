# Aino 技能与插件目录

Aino 官网技能与插件中心的内容仓库。这里维护源文件和生成的 JSON 目录；
不包含 Aino 软件，不会自动安装或执行任何扩展。

当前提供 3 个 Aino 自有技能：资料研究（research-brief）、项目规划（project-planner）、
内容写作（writing-editor）。Aino 自有插件目录目前为空，不发布占位插件。

Aino 官网还会实时聚合 Hermes 官方技能与插件目录。外部条目仍由各自上游维护，
不会复制到本仓库；本仓库只存放 Aino 自有内容及其网站目录元数据。

## 目录结构

```text
skills/<slug>/SKILL.md       技能指令
skills/<slug>/catalog.json   中英文目录信息
plugins/<slug>/plugin.yaml   插件清单
plugins/<slug>/README.md     使用说明
plugins/<slug>/catalog.json  中英文目录信息
plugins/<slug>/…             真实实现代码
catalog/catalog.json         网站使用的完整目录
catalog/skills.json          技能目录（同样的封装格式）
catalog/plugins.json         插件目录（同样的封装格式）
scripts/build-catalog.mjs    校验与生成器
```

## 添加技能

1. 在 `skills/` 下新建小写、连字符命名的目录，例如 `research-start`。
2. 添加 `SKILL.md`，当前生成器支持下列简单 frontmatter 格式：

```markdown
---
name: research-start
description: Create a focused research outline from a topic and intended decision.
---

# Research Start

在此写明适用场景、任务方法、边界与交付要求。
```

`name` 必须匹配目录名，`description` 使用单行文本。当前校验器只接受这两个
frontmatter 字段，不是通用 YAML 解析器。更多展示元数据放入 `catalog.json`。
技能可以带 references/、scripts/ 等实际所需的支持文件；在指令中写明相对路径。

3. 添加 `catalog.json`：

```json
{
  "kind": "skill",
  "slug": "research-start",
  "name": "research-start",
  "title": { "zh": "研究起步", "en": "Research Start" },
  "description": {
    "zh": "将研究主题整理为问题、来源方向和核对清单。",
    "en": "Turn a research topic into questions, source directions and a verification checklist."
  },
  "category": "research",
  "tags": ["research", "planning"],
  "platforms": ["macos", "windows", "linux"],
  "author": "Aino",
  "version": "1.0.0",
  "license": "MIT"
}
```

分类建议使用 `research`、`productivity`、`writing`、`development`、`integration`、
`other`。其他分类键也会显示。版本号使用 `1.0.0` 或 `1.0.0-beta.1`。
平台表示内容适用范围，不能用来宣称已经验证某个 Aino 安装版本。

## 添加插件

使用 `plugins/<slug>/`，元数据的 `kind` 为 `plugin`。需要包含 `plugin.yaml`、
`README.md` 和至少一个真实的 `.py`、`.js`、`.ts`、`.mjs` 或 `.cjs` 实现文件。
清单的顶层 `name:` 必须与目录名一致。生成器仅检查最低发布条件，不替代插件
运行测试、完整 YAML/宿主清单校验或兼容性验收。

安装地址从仓库及子目录生成，默认指向 main 分支；它不是经过审核的固定提交版本。
未来接入 Aino 插件安装流程时，需要明确采用仓库安装或自有审核目录解析，不能只
把名称当作 Hermes 官方插件目录中的名称。

## 校验与发布

需要 Node.js 20+，无第三方依赖。

```sh
npm run build
npm test
```

将源文件和 `catalog/` 一并提交。生成结果不含变化的时间戳，`revision` 是内容
哈希，相同输入产生相同输出。GitHub Actions 对 Pull Request 和 main 提交运行
测试并重新构建，生成结果未同步时会失败。新增、修改或删除内容都需重新构建。

公共数据地址：

https://raw.githubusercontent.com/OneWhitepaper/Aino-skill-plugins/main/catalog/catalog.json

官网先展示随站点构建的 Aino 快照，再尝试读取此地址，并同时读取 Hermes 官方目录。
网络不可用时仍可浏览 Aino 快照。
官网更新快照：`npm run catalog:sync`，然后重新 `npm run build`。

## 使用与边界

在支持 Hermes 技能命令的环境中，例如：

```sh
hermes skills install OneWhitepaper/Aino-skill-plugins/skills/research-brief
```

本仓库只提供内容，具体安装、权限、审查与会话生效行为由目标软件处理。
本次不修改或运行 Aino 软件，未进行软件安装联调。网页内嵌模式及消息约定见官网
项目的 `docs/skill-center-integration.md`。

## License

本仓库首批内容使用 MIT 许可，见 LICENSE。新增第三方内容时保留原作者及其许可，
并确认拥有再分发权利；不要把上游来源误标为 Aino 原创。
