# AI 作业批改工具 — v2 架构附录（增量）

## 文档信息

| 字段     | 值                                                                  |
| -------- | ------------------------------------------------------------------- |
| 版本     | v0.1.0                                                              |
| 日期     | 2026-08-16                                                          |
| 作者     | sally                                                               |
| 依据     | `docs/prd-v2.md` v0.1.0、`docs/architecture.md` v1.1、`docs/architecture-wechat-miniapp.md` v0.1.0、`contracts/openapi.yaml` v0.1.1、作用域化访谈 |
| 变更说明 | 初始版本 — v2 新增功能的架构决策。仅记录**新增决策（AD-18 起）**，不重复现有架构。 |

> 本文件是 `docs/architecture.md` 与 `docs/architecture-wechat-miniapp.md` 的**增量附录**。现有架构已覆盖的内容（技术栈、数据模型主结构、批改管线骨架、图片标注、错题集一致性等）不重复；本文只记录 v2 带来的**新增决策与变更点**。

---

## 1. 架构决策记录（AD-18 起）

### 1.1 认证架构

### AD-18: 短信验证码 + 纯 JWT 会话（无状态认证）

**决策：** 以「手机号 + 短信验证码」登录，签发**纯 JWT** 作为会话凭证；**无服务端会话存储、无撤销机制**（登出 = 前端清除 token）。`sub` = `Parent.id`（即 userId），`exp` = 30 天，算法 HS256。

**理由：**
- 取代现有「phone 信任模型」（无验证、URL 携带 phone），`phone` 退居登录凭据，不再作为业务请求的身份入参。
- 纯 JWT 零服务端状态，契合「家庭自用、单机 MySQL」现状，不引入 Redis。
- 30 天有效期在「登录摩擦」与「无撤销带来的风险窗口」间取平衡；家庭内网风险低。
- 登出为前端清 token，服务端无状态、无需登出端点。

**代价（已接受）：** token 在 `exp` 前**无法主动撤销**——手机号换绑、账号异常时旧 token 仍有效至过期。对外开放前须升级为可撤销会话（session / redis / 黑名单）。

**无数据模型变更：** JWT 无状态，`Parent` 表无需新增会话字段；`Parent.phone` UNIQUE 保留（首次登录即注册的幂等键）。

**验证码方案：** 6 位数字，有效期 5 分钟，同手机号 60 秒重发间隔；经阿里云短信发送。验证码存储于**内存（单机）或 DB 表**，实现时定，不入核心表。

**小程序登录统一（移除 `wechat-login`）：** 小程序与 Web **共用同一套 SMS 登录**（`send-code` + `login`），不保留 v1 的 `POST /api/wechat-login`（openid 静默登录 / 设备绑定）端点——v2 将其**移除**。小程序登录后 JWT 缓存于本地存储，30 天有效期内免重复登录。`Parent.openid` 列保留（forward-only 不删列）但 v2 不再使用，openid 不出现在任何端点。该决策替代 v1 AD-13 / AD-16 的小程序独立登录路径。

---

### AD-19: 身份标识从 phone 迁移到 userId（`Parent.id`）

**决策：** 业务请求的身份标识由 `phone` 改为 **userId（即 `Parent.id`）**，通过 JWT 的 `sub` 传递；所有业务端点移除 `phone` 参数 / `X-Parent-Phone` 头，改走 `Authorization: Bearer <token>`。

**理由：**
- `phone` 是敏感数据（PII），不应出现在 URL / query / 日志中；userId 是内部整数，无泄露风险。
- 后端解析身份只需验签 JWT → 取 `sub` → 得 `parent_id`，一次依赖注入完成，与现有 §8「数据归属隔离」不变量无缝衔接（原「phone→parent_id」解析替换为「token→parent_id」）。
- 用现有自增 `Parent.id` 作 userId，**零表结构改动**、零迁移；家庭自用无需 UUID 防枚举（对外前再评估）。

**代价：** 全部业务端点 + Web 前端 + 小程序 transport 层都要从 `phone` 参数切换到 Bearer 头（破坏性契约变更，见 `contract-changes-v2.md`）。`phone` 仅保留在登录 / 发码两个端点。

---

### AD-20: 图片签名 URL（解决 `<img>` 无法带 Authorization 头）

**决策：** 图片端点 `GET /api/images/{kind}/{filename}` 由 `?phone=` 归属校验改为**签名 URL**：API 返回图片地址时附带 HMAC 短期签名 token（`?token=…&expires=…`，默认 1 小时有效），`<img>` / `<image>` 直接加载，无需请求头。

**理由：**
- `<img>` / `<image>` 标签不能携带 `Authorization` 头，去 phone 化后图片加载必须走独立鉴权通道。
- HMAC 签名 token 不含 PII，可安全出现在 URL；短期有效（1 小时）限制泄露窗口。
- 签名校验仍可沿 `submission_id`（内嵌在 filename）追溯归属，保持架构 §8「图片归属校验」不变量。

**签名方案：** `token = base64url(expires).base64url(HMAC-SHA256(secret, kind + "/" + filename + ":" + expires))`；密钥独立环境变量 `IMAGE_SIGNING_SECRET`。校验时验签名 + `expires` 未过期 + filename 内嵌的 `submission_id` 归属当前 userId。

---

### 1.2 模型抽象层

### AD-21: `VisionModel` provider 抽象（多供应商可切换）

**决策：** 将批改服务的模型调用从「写死 GLM」重构为 `VisionModel` 抽象接口，提供 GLM-4V 与 Qwen-VL 两个实现；**运维层**（环境变量）切换，前端不可见、不可选。DeepSeek 留扩展点，本期不实现。

**接口定义：**

```
class VisionModel(Protocol):
    async def grade(self, image: bytes, subject: Subject) -> GradingResult: ...

@dataclass
class GradingResult:
    questions: list[GradedQuestionData]   # 题号/坐标/对错/思路/题型
    # 每道题含 question_text（英语纯文本题干）/ question_latex（数学 LaTeX 题干），见 AD-23
    raw_json: dict                        # provider 原始返回（存档）
    token_usage: TokenUsage               # 含 provider + model，见 AD-22
```

**实现：**
- `GLMVisionModel`：复用现有 `glm_client.py` 逻辑，重构为实现类。
- `QwenVisionModel`：新增，调用阿里云百炼 OpenAI 兼容接口（`/compatible-mode/v1/chat/completions`），输出 schema 与 `GradedQuestion` 对齐。
- 工厂：按环境变量 `VISION_PROVIDER=glm|qwen` 选择实现，`VISION_MODEL` 指定具体型号（默认 `glm-4v-flash` / `qwen-vl-max`）。

**理由：**
- 视觉批改是唯一需要模型的调用（文字试卷是模板拼装，见 AD-25），故只需抽象视觉模型。
- GLM-4V 与 Qwen-VL 均有确定的视觉 API；DeepSeek 官方视觉 API 存疑（截至 2026-08），仅留接口扩展点，待明朗后补 `DeepSeekVisionModel` 即可，零架构改动。
- 运维层切换契合现有「模型选择由环境变量控制、前端不可见」的约束（F-02 AC-08）。

---

### AD-22: 无文本模型 + 多供应商成本日志

**决策：** **不引入文本模型**（文字试卷由 DB 取错题题干模板拼装，见 AD-25，无需 LLM 生成）。成本日志 `token_usage` 扩展为多供应商结构，记录每次调用的 `provider` 与 `model`。

**理由：**
- v2 无文本生成任务，抽象文本模型是过度设计；`vision` 与 `text` 无需分流（只有 vision 一条链）。
- 多供应商后，成本核算需区分「哪家供应商、哪个型号」消耗了多少 token，否则 50 元/月预算无法拆分归因。

**token_usage 结构变更：**

```json
{
  "provider": "qwen",
  "model": "qwen-vl-max",
  "prompt_tokens": 1200,
  "completion_tokens": 800,
  "total_tokens": 2000
}
```

> 现有 `token_usage`（无 provider/model 的旧记录）在读取时兼容；新记录统一带 `provider` + `model`。

---

### 1.3 错题文本

### AD-23: 题干文字落库（`question_text` / `question_latex`）

**决策：** 批改时由视觉模型**顺手输出完整题干文字**，随批改结果落库。英语题为纯文本（`question_text`），数学题为 LaTeX（`question_latex`）。**不引入独立 OCR 引擎**。

**数据模型变更：**

| 表               | 新增字段                                   | 约束    |
| ---------------- | ------------------------------------------ | ------- |
| `GradedQuestion` | `question_text` TEXT / `question_latex` TEXT | 均可空   |
| `ErrorQuestion`  | `question_text` TEXT / `question_latex` TEXT | 均可空（冗余） |

> `ErrorQuestion` 按现有 `solution_note` / `error_category` 的**物化缓存模式**冗余（错题集查询 / 试卷生成不回连批改表）。GradedQuestion 题干变更时同事务刷新 ErrorQuestion（与架构 §8「错题集一致性」一致）。

**理由：**
- 视觉模型已在批改时读图，让其多输出一个「题干文字」字段几乎零额外调用成本（仅多输出 token）。
- 题干文字是 F-17 文字试卷的原料（AD-25），也是错题集「截图之外可检索、可复用」的描述。
- 先以视觉模型输出验证效果，质量不足再升级为独立 OCR（见 AD-24 预留点），符合「解决问题而非提前堆架构」。

**限制（已接受）：** 手写体、几何图形、竖式等纯图形内容无法转文字，数学题题干可能残缺；本期不支持人工修正。

---

### AD-24: 批改流水线扩展（prompt 输出题干 + LaTeX + OCR 预留点）

**决策：** 批改 prompt 增加「题干文字」输出字段（英语 `question_text`、数学 `question_latex`）；流水线解析后写入 `GradedQuestion` 与 `ErrorQuestion`。预留 `QuestionTextExtractor` 抽象，未来可插入独立 OCR 实现。

**流水线变更（相对架构 §6.1）：**

```
上传 → VisionModel.grade()（批改 + 题干文字）→ 解析 JSON
     → 存 GradedQuestion（含 question_text / question_latex）
     → 标注图片 / 裁剪题目截图
     → 同步 ErrorQuestion（冗余题干文字）
     → status=completed
```

**OCR 预留点：**

```
class QuestionTextExtractor(Protocol):
    async def extract(self, image: bytes, subject: Subject) -> QuestionText: ...

class VisionModelExtractor: ...      # 当前实现（视觉模型顺手输出）
# class OCRExtractor: ...           # 预留：接 PaddleOCR / MinerU
```

**理由：** 数学题公式 / 几何图形的文字转写质量存在上限，预留 `QuestionTextExtractor` 抽象使「视觉模型输出」与「独立 OCR」可在不破坏流水线的前提下替换；当前仅实现视觉模型路径。

---

### 1.4 试卷生成

### AD-25: 文字试卷模板拼装（无 LLM）

**决策：** 文字试卷由**从错题集随机取题干文字 + 固定版式拼装**生成，**不调用任何 LLM**。原料为 F-16 落库的 `question_text` / `question_latex`（AD-23）。

**生成管线：**

```
POST /api/error-collections/generate {child_id, subject, ..., format:"text", count}
  → 按筛选条件查询 ErrorQuestion（含 question_text / question_latex）
  → 随机选取 count 条
  → 拼装文字试卷：标题栏（小朋友名 + 学科 + 日期）+ 题干 + 作答空白区
  → 返回结构化题目列表（供前端 HTML 渲染预览）+ 生成 .docx（见 AD-26）
```

**理由：** 错题题干文字已在 AD-23 落库，模板拼装零模型成本、结果确定、可预期；LLM 生成无必要且引入额外 token 成本与不确定性。

**数学题处理：** `question_latex` 由前端 KaTeX 渲染（Web）；小程序端数学题以截图为主、文字为辅（不在小程序内渲染 LaTeX）。残缺题干由题目截图「查看原图」兜底。

---

### AD-26: Word 导出（python-docx + LaTeX→PNG）+ 格式切换不持久化

**决策：** `.docx` 用 **python-docx** 生成；数学 `question_latex` **渲染成 PNG 嵌入**（matplotlib mathtext 或 MathJax 离线渲染）；试卷不含标准答案。格式（文字 / 图片）为**生成时当场选、不持久化**。

**理由：**
- python-docx 是最主流 `.docx` 库；LaTeX 无法直接写入 docx，转 OMML（Word 原生公式）坑多（中文 / 矩阵 / 分数兼容差），渲染成 PNG 嵌入最稳、打印清晰（可控制分辨率）。
- 格式作为生成参数（与学科 / 题型 / 数量同层级），低频操作无需持久化偏好；默认「文字」由前端生成页 UI 默认选中（显式传 `format=text`），API 层 `format` 默认 `image` 以保持向后兼容（见 `contract-changes-v2.md`）。

**代价（已接受）：** 嵌入的公式为图片、不可再编辑；家庭自用「打印重做」场景完全够用。

**小程序端 docx 预览：** 小程序经 `wx.downloadFile` 下载 `.docx` 到临时路径，再用 `wx.openDocument({ fileType: 'docx' })` 在小程序内预览（微信官方支持 docx）。受微信沙盒隔离限制，docx 仅能**预览 / 分享**，无法写入手机系统文件（相册 / 文件管理器）；需长期保存时走 Web 端下载。

---

## 2. 数据模型变更汇总

| 表               | 变更                                                                                     | 迁移    |
| ---------------- | ---------------------------------------------------------------------------------------- | ------- |
| `Parent`         | 无结构变更（`id`/`phone` 已满足 JWT 无状态会话；`openid` 列保留但 v2 不再使用）           | 无      |
| `Child`          | + `grade` VARCHAR(20) NOT NULL DEFAULT '五年级'；+ `note` VARCHAR(200) NULL；+ `avatar` VARCHAR(500) NULL（预留） | forward-only |
| `GradedQuestion` | + `question_text` TEXT NULL；+ `question_latex` TEXT NULL                                 | forward-only |
| `ErrorQuestion`  | + `question_text` TEXT NULL；+ `question_latex` TEXT NULL（冗余）                         | forward-only |
| 验证码           | 存内存或 DB 表（实现时定），不入核心表                                                   | 按实现定 |

> 均以 Alembic **forward-only** 迁移落地（架构 §8 迁移策略），迁移文件人工审核。

---

## 3. 安全模型变更

| 维度           | 现状（MVP）                       | v2 目标                                        |
| -------------- | --------------------------------- | ---------------------------------------------- |
| 身份标识       | `phone`（信任输入，URL 携带）      | userId（`Parent.id`，JWT `sub`）               |
| 登录           | 无（输入即用）                     | 短信验证码 + JWT 签发                          |
| 请求鉴权       | `phone` query / `X-Parent-Phone` 头 | `Authorization: Bearer <token>`                |
| 图片鉴权       | `?phone=` 归属校验                | 签名 URL（HMAC 短期 token）                     |
| 数据隔离       | phone → parent_id 依赖注入         | token → parent_id 依赖注入（不变量不变）        |
| 撤销能力       | —                                 | 无（纯 JWT，前端清 token 即登出）               |
| 密钥管理       | `GLM_API_KEY`、`MYSQL_PASSWORD`   | + `JWT_SECRET`、`IMAGE_SIGNING_SECRET`、阿里云短信密钥、`QWEN_API_KEY` |

**不变量保持不变（架构 §8）：** 所有返回用户数据的查询仍必须带 `parent_id`（由 token 解析）过滤；任何端点不得直接接受 `parent_id` 入参；跨资源归属校验失败一律 404。

---

## 4. 环境变量汇总（新增）

| 变量                     | 说明                          |
| ------------------------ | ----------------------------- |
| `JWT_SECRET`             | JWT 签名密钥（HS256）         |
| `IMAGE_SIGNING_SECRET`   | 图片签名 URL 的 HMAC 密钥      |
| `VISION_PROVIDER`        | `glm` \| `qwen`，模型供应商   |
| `VISION_MODEL`           | 具体型号（默认 `glm-4v-flash` / `qwen-vl-max`） |
| `QWEN_API_KEY`           | 阿里云百炼 API Key            |
| `SMS_ACCESS_KEY_ID` / `SMS_ACCESS_KEY_SECRET` | 阿里云短信访问密钥 |
| `SMS_SIGN_NAME` / `SMS_TEMPLATE_CODE` | 短信签名 / 模板号 |

---

## 5. 已知限制与后续

1. **纯 JWT 无法主动撤销**：旧 token 在 `exp` 前有效；对外前升级为可撤销会话。
2. **题干文字转写不精确**：手写 / 复杂公式可能出错，本期不支持人工修正；升级路径为 `QuestionTextExtractor` 的独立 OCR 实现（PaddleOCR / MinerU）。
3. **短信服务引入云依赖与成本**：阿里云短信按条计费，需纳入 50 元/月预算之外的专项成本。
