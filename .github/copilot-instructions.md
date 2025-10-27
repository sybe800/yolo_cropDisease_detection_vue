## 目的
为 AI 编码代理 (Copilot/agents) 提供一份简洁、实用的入门说明，帮助快速理解本仓库的架构、开发流程、约定与关键文件路径。

## 项目概览（大局）
- 技术栈：Vue 3 + Vite + TypeScript + Pinia + Vue Router + Element Plus。
- 结构要点：`/src` 是主要目录，常见子目录：
  - `src/main.ts`：应用入口，注册 Pinia、Router、i18n、Element Plus 和全局组件/图标。
  - `src/router/`：路由配置（前端/后端路由拆分在 `router/` 下）。
  - `src/stores/`：Pinia 状态管理。
  - `src/api/`：按模块组织的后端 API 封装（例如 `api/login/index.ts`）。
  - `src/views/` / `src/layout/`：页面与布局组件集合（业务视图放在 `views/`）。
  - `src/utils/`：工具、请求封装（`request.ts` 使用 axios）、存储等通用工具。

## 运行与构建（关键命令）
- 本地开发：`npm run dev`（等同于 `vite --force`）
- 打包：`npm run build`（vite build）
- 自动修复 eslint：`npm run lint-fix`

环境与代理
- `.env` 中常用变量：`VITE_PORT`, `VITE_OPEN`, `VITE_PUBLIC_PATH`。
- `vite.config.ts` 中定义了 dev-server 的 proxy：
  - `/api` -> `http://localhost:9999/`（后端接口代理）
  - `/flask` -> `http://localhost:5000/`（用于模型/Flask 服务）

## 导入别名与路径约定
- Vite + tsconfig 设置了别名 `/@` 指向 `src/`（见 `vite.config.ts` 和 `tsconfig.json`）。示例：
  - `import pinia from '/@/stores/index'` 等。
 代理/别名约定在代码里很常见，AI 生成代码时请优先使用 `/@/...` 风格导入。

## API 与请求约定（项目特定）
- 全局 axios 实例在 `src/utils/request.ts`：
  - baseURL 由 `import.meta.env.VITE_API_DOMAIN` 控制
  - 请求拦截器会尝试从 `Session.get('token')` 添加 `Authorization` header
  - 响应拦截器对 401/4001 做统一登出处理（清缓存并重定向到登录页）
  - 错误处理通过 Element Plus 的 `ElMessage`/`ElMessageBox` 全局弹窗

当生成或修改调用后端的代码时：
- 使用 `src/api/<module>/index.ts` 的模块封装模式，保持与现有文件一致的命名与导出风格。

## UI 与国际化
- Element Plus 全局注册（`src/main.ts`），图标从 `@element-plus/icons-vue` 批量引入并注册。
- 项目使用 `vue-i18n`（见 `src/i18n/`），UI 中的 Element Plus 文本通过 i18n 回调传入：
  - `app.use(ElementPlus, { i18n: i18n.global.t })`

## 代码风格与类型
- TypeScript 严格模式 `strict: true`（见 `tsconfig.json`），但 `noImplicitAny` 被置为 `false`。
- ESLint + Prettier 在 devDependencies 中，使用 `npm run lint-fix` 修复常见 issue。

## 常见修改点与示例
- 新增页面：在 `src/views/<feature>/` 添加页面组件并在 `src/router` 注册路由。
- 新增 API 模块：在 `src/api/<feature>/index.ts` 导出以 axios 实例为基础的函数。
- 状态：在 `src/stores/` 新建 Pinia store，并在 `main.ts` 中无需额外挂载（已全局使用 Pinia）。

## 调试与常见陷阱
- 本地接入后端时，注意使用 proxy 前缀 `/api` 或 `/flask`，不要硬编码真实主机域名（方便切换）。
- token 流程由 `Session` (`src/utils/storage.ts`) 管理，登出逻辑在 `request.ts` 的响应拦截器中触发。
- 构建时 base 路径来自 `VITE_PUBLIC_PATH`，发布静态站点时确认该值正确。

## 当你需要做自动化修改（给 AI 的建议样式）
- 优先复用现有模块与路径（`/@/api`, `/@/stores`, `/@/views`）。
- 不要更改全局状态管理的初始化方式；新增 store 使用 Pinia 的标准导出。
- 在修改请求/错误处理时，保留对 `ElMessage`/`ElMessageBox` 的调用风格以保持用户体验一致性。

## 参考文件
- `src/main.ts`：应用入口，注册了所有全局插件
- `vite.config.ts`：别名、proxy、build 输出与 chunk 策略
- `src/utils/request.ts`：axios 实例与拦截器（关键行为点）
- `tsconfig.json`：`/@` -> `src/` 的类型路径映射
- `package.json`：可用 npm scripts

如果这份说明中有任何遗漏或你希望我把某些实现细节（如具体 API 模块示例）加入，请告诉我需要补充的目标文件或功能点。
