# AI 作业批改工具 — contracts/openapi.yaml 变更提案（v2）

## 文档信息

| 字段     | 值                                                       |
| -------- | -------------------------------------------------------- |
| 版本     | v0.1.0（提案草案）                                       |
| 日期     | 2026-08-16                                               |
| 依据     | `docs/prd-v2.md` v0.1.0、`docs/architecture-v2.md` v0.1.0、`contracts/openapi.yaml` v0.1.1 |
| 状态     | **已批准并落地** —— 已写入 `contracts/openapi.yaml` v0.2.0       |

> ✅ 人工审批通过（2026-08-16）。全部 7 处变更已落地到 `contracts/openapi.yaml`（v0.1.1 → v0.2.0）；`POST /api/wechat-login` 经复审**移除**（小程序登录与 Web 统一为 SMS + JWT，不再保留 openid 静默登录 / 设备绑定）。下文为变更记录，供追溯。

---

## 1. 变更总览

| # | 变更 | 类型 | 破坏性 |
| - | ---- | ---- | :----: |
| 1 | 新增 auth 端点（发验证码 / 登录） | 新增 | 否 |
| 2 | `securitySchemes`：`parentPhone`/`parentPhoneHeader` → `bearerAuth` | 修改 | **是** |
| 3 | 所有业务端点去 phone 化（改 Bearer 鉴权） | 修改 | **是** |
| 4 | 图片端点改签名 URL（`?phone=` → `?token=&expires=`） | 修改 | **是** |
| 5 | `Child` schema + `POST/PUT /api/children` 加 `grade`/`note`/`avatar` | 扩展 | 否 |
| 6 | `GradedQuestion` / `ErrorQuestion` 加 `question_text`/`question_latex` | 扩展 | 否 |
| 7 | `POST /api/error-collections/generate` 加 `format` + 文字试卷响应 | 扩展 | 否 |
| 8 | `POST /api/wechat-login` **移除**（小程序登录统一为 SMS + JWT） | 移除 | **是** |

**破坏性变更（4 处）**：变更 2、3、4、8 要求前端 + 小程序 transport 层 + 现有 curl 脚本同步改造，否则旧客户端调用将 401 / 403，或命中已移除的 `wechat-login` 端点、响应结构不匹配。

**向后兼容变更（4 处）**：变更 1、5、6、7 为纯新增或加可选字段，老客户端不传新字段仍正常工作（变更 7 的 `format` 默认 `image` 保持现有行为）。

---

## 2. 详细变更

### 变更 1：新增 auth 端点（`POST /api/auth/send-code`、`POST /api/auth/login`）

**登出说明**：纯 JWT 无状态（AD-18），**无登出端点**——登出 = 前端清除本地 token；服务端无会话可撤销。「会话」由 JWT 的 `exp`（30 天）承载。

```yaml
  /api/auth/send-code:
    post:
      operationId: sendVerificationCode
      tags: [Auth]
      summary: Send an SMS verification code
      description: |
        Sends a 6-digit code via Aliyun SMS. Rate-limited: 60s between sends
        per phone. The code itself is never returned in the response.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone]
              properties:
                phone:
                  type: string
                  pattern: '^\d{11}$'
      responses:
        "200":
          description: Code sent
          content:
            application/json:
              schema:
                type: object
                required: [retry_after]
                properties:
                  retry_after:
                    type: integer
                    example: 60
                    description: Seconds before a new code may be requested
        "429":
          description: Too many requests (rate limited)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /api/auth/login:
    post:
      operationId: login
      tags: [Auth]
      summary: Verify code and issue a JWT
      description: |
        Verifies the SMS code and issues a JWT whose sub claim is the parent
        id (userId). First login auto-creates the Parent (phone UNIQUE).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone, code]
              properties:
                phone:
                  type: string
                  pattern: '^\d{11}$'
                code:
                  type: string
                  pattern: '^\d{6}$'
      responses:
        "200":
          description: JWT issued
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LoginResponse"
        "401":
          description: Invalid or expired code
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
```

**新增 schema：**

```yaml
    LoginResponse:
      type: object
      required: [token, token_type, expires_at, user_id]
      properties:
        token:
          type: string
          description: JWT (sub = Parent.id, exp = 30 days)
        token_type:
          type: string
          enum: [Bearer]
        expires_at:
          type: string
          format: date-time
        user_id:
          type: integer
          description: Parent.id (userId)
```

---

### 变更 2：`securitySchemes` 替换（破坏性）

```yaml
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        JWT issued by POST /api/auth/login. sub = Parent.id (userId).
        Applies to all business endpoints.
    cookieAuth:
      type: apiKey
      in: cookie
      name: session
      description: |
        Future scheme — retained for migration reference only.
```

**移除**：`parentPhone`、`parentPhoneHeader` 两个 securityScheme。

---

### 变更 3：所有业务端点去 phone 化（破坏性）

所有业务端点（除 `/api/health`、`/api/auth/*`、`/api/images/*`）执行：

- **移除** `phone` query 参数与 `X-Parent-Phone` 请求头说明；
- **移除** security 覆盖 `[{"parentPhone": []}]` 或 `[{"parentPhoneHeader": []}]`；
- 端点级 **新增** `security: [{ bearerAuth: [] }]`（或继承全局 `security`）。

受影响的端点：`GET/POST /api/children`、`PUT/DELETE /api/children/{child_id}`、`POST/GET /api/submissions`、`GET /api/submissions/{id}`、`PATCH /api/submissions/{id}/questions/{qid}`、`GET /api/error-collections`、`POST /api/error-collections/generate`。

> `phone` 仅保留在 `POST /api/auth/send-code` 与 `POST /api/auth/login` 的请求体中。

---

### 变更 4：图片端点改签名 URL（破坏性）

```yaml
  /api/images/{kind}/{filename}:
    get:
      operationId: serveImage
      tags: [Submissions]
      summary: Serve an image file via a signed URL
      description: |
        Serves image files from the local filesystem. Authentication is via a
        signed URL (HMAC token + expiry), not the Authorization header, because
        <img>/<image> tags cannot send headers. Ownership is still verified
        through the submission_id embedded in the filename.
      security: []   # 签名即鉴权，不走 bearerAuth
      parameters:
        - name: kind
          in: path
          required: true
          schema:
            type: string
            enum: [originals, annotated, thumbnails, questions, sheets]
        - name: filename
          in: path
          required: true
          schema:
            type: string
            description: "{submission_id}.jpg or {submission_id}_{qnum}.jpg or {uuid}.jpg"
        - name: token
          in: query
          required: true
          schema:
            type: string
            description: HMAC signature token (base64url)
        - name: expires
          in: query
          required: true
          schema:
            type: integer
            description: Expiry as Unix timestamp (default TTL 1 hour)
      responses:
        "200":
          description: Image file (JPEG binary)
          content:
            image/jpeg:
              schema:
                type: string
                format: binary
        "403":
          description: Invalid or expired signature
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "404":
          $ref: "#/components/responses/NotFound"
```

---

### 变更 5：`Child` schema + `children` 端点（向后兼容）

**`Child` schema：**

```yaml
    Child:
      type: object
      required: [id, name, grade, submission_count, created_at]
      properties:
        id:
          type: integer
        name:
          type: string
          example: "小明"
        grade:
          type: string
          enum: [一年级, 二年级, 三年级, 四年级, 五年级, 六年级]
          description: Required; defaults to 五年级 on create.
        note:
          type: string
          nullable: true
          maxLength: 200
        avatar:
          type: string
          nullable: true
          description: Reserved field; not implemented in v2 (no upload/edit/display).
        submission_count:
          type: integer
        created_at:
          type: string
          format: date-time
```

**`POST /api/children` 请求体：**

```yaml
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name:
                  type: string
                  minLength: 1
                  maxLength: 50
                grade:
                  type: string
                  enum: [一年级, 二年级, 三年级, 四年级, 五年级, 六年级]
                  default: 五年级
                note:
                  type: string
                  maxLength: 200
```

**`PUT /api/children/{child_id}` 请求体**：同 `POST`（`name` + 可选 `grade` + 可选 `note`）。

---

### 变更 6：`GradedQuestion` / `ErrorQuestion` 加题干字段（向后兼容）

两个 schema 各加两个**可空**字段（不影响现有响应结构）：

```yaml
        question_text:
          type: string
          nullable: true
          description: Transcribed full question text (English).
        question_latex:
          type: string
          nullable: true
          description: Transcribed question in LaTeX (Math). Empty for English.
```

---

### 变更 7：`generate` 端点加 `format` + 文字试卷响应（向后兼容）

**请求体**加可选 `format`（默认 `image` 保持现有行为；前端生成页 UI 默认选「文字」并显式传 `text`）：

```yaml
                format:
                  type: string
                  enum: [text, image]
                  default: image
                  description: |
                    Output format. Defaults to image for backward compatibility.
                    The frontend sheet-generation page defaults to "text" and
                    sends format=text explicitly.
```

**响应 schema** 由内联对象改为 `GeneratedSheet`（`format=image` 时返回 `image_url`，`format=text` 时返回 `questions` + `docx_url`）：

```yaml
    GeneratedSheet:
      type: object
      required: [format, question_count]
      properties:
        format:
          type: string
          enum: [text, image]
        question_count:
          type: integer
        image_url:
          type: string
          format: uri
          description: Present when format=image. Generated practice sheet image.
        questions:
          type: array
          items:
            $ref: "#/components/schemas/SheetQuestion"
          description: Present when format=text. Randomly selected error questions.
        docx_url:
          type: string
          format: uri
          description: Present when format=text. Download link for the .docx sheet.

    SheetQuestion:
      type: object
      required: [question_number, question_type, subject]
      properties:
        question_number:
          type: string
        question_type:
          type: string
          enum: [choice, fill_blank, reading, composition, calculation, word_problem]
        subject:
          type: string
          enum: [english, math]
        question_text:
          type: string
          nullable: true
          description: Transcribed text (English); rendered directly.
        question_latex:
          type: string
          nullable: true
          description: Transcribed LaTeX (Math); rendered client-side (KaTeX) or as PNG in .docx.
        question_image_path:
          type: string
          nullable: true
          description: Fallback cropped image for questions without usable text.
        source_submission_id:
          type: integer
          description: Origin submission (for traceability).
```

---

### 变更 8：移除 `POST /api/wechat-login`（破坏性）

经复审，小程序登录与 Web **统一为 SMS + JWT**，不再保留 v1 的 openid 静默登录 / 设备绑定端点。`POST /api/wechat-login` 及 `WechatLoginRequest` schema 从契约中**移除**。

- 小程序登录流：`POST /api/auth/send-code` + `POST /api/auth/login`（与 Web 完全一致）→ JWT 缓存于本地存储 → 30 天有效期内复用，无需静默登录。
- `Parent.openid` 列保留（forward-only 迁移不删列），但 v2 不再读写，openid 不出现在任何端点 / 响应。
- 既有 W1~W4 已实现的 `wechat-login`（后端端点 + 小程序调用）须在 X1 一并移除。

```yaml
# 已从契约删除：
#   POST /api/wechat-login
#   components.schemas.WechatLoginRequest
```

---

## 3. 破坏性变更的迁移影响

| 变更 | 影响面 | 迁移动作 |
| ---- | ------ | -------- |
| 2. securitySchemes 替换 | 契约定义 | 删旧 scheme、加 bearerAuth |
| 3. 去 phone 化 | 前端 `lib/api.ts`、小程序 `lib/api.ts`、所有调用点 | transport 层统一注入 `Authorization: Bearer <token>`；移除 `?phone=` / `X-Parent-Phone` |
| 4. 图片签名 URL | 前端/小程序图片渲染 | 不再手工拼 `?phone=`；直接使用 API 返回的已签名 `image_url` / `thumbnail_url` |
| 8. wechat-login 移除 | 小程序登录流（`lib/api.ts`、登录页、既有 W1~W4 实现） | 移除 `POST /api/wechat-login` 调用与后端端点；小程序改走 SMS 登录页 + 本地缓存 JWT |

**建议落地顺序**：先合并变更 1（新增 auth 端点，纯新增、无风险），再合并变更 2/3/4/8（认证切换 + wechat-login 移除，破坏性），最后合并 5/6/7（字段扩展，向后兼容）。

---

## 4. 审批检查清单

- [ ] 变更 1：auth 端点命名 / 响应字段（`LoginResponse` 是否含 `user_id`）
- [x] 变更 2/3：`bearerAuth` scheme 与「去 phone 化」范围确认——`wechat-login` 端点经复审**移除**（变更 8），不再涉及 JWT 衔接问题。
- [ ] 变更 4：签名 URL 的 `expires` 单位（Unix 秒）与 TTL（默认 1 小时）
- [ ] 变更 5：`grade` 枚举存储形式（契约层字符串枚举，DB 层 VARCHAR）
- [ ] 变更 7：`format` 默认值 `image`（向后兼容）与 PRD「默认文字」的关系是否接受（前端 UI 默认选「文字」）
