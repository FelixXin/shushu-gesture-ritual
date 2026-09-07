# Three.js 14 层罗盘设计

## 目标

将“玄枢 · 手势起卦”的二维 CSS 圆盘升级为原创的 Three.js 14 层可展开罗盘，同时保留现有六爻生成、动爻/变卦解析、手动备选操作和 Docker 部署方式。

视觉方向采用“玄枢 · 虚空星盘”：深墨背景、金色主环、青玉色交互反馈。静止时是易读的平面阵盘；展开时保持全部环带同心，只沿预设 Z 轴深度分层。

## 许可边界

`huzoukai/hui-gesture-bagua` 仅作为产品结构与交互节奏参考。其 PolyForm Noncommercial 许可不适合直接移植到本项目，因此不复制该仓库的代码、着色器、纹理、声音、文案或媒体素材。本实现使用独立的数据结构、CanvasTexture 绘制和 Three.js 场景代码。

## 手势与起卦

- 食指：唤醒阵盘、移动阵眼焦点。
- 握拳：在平面与 3D 展开状态之间切换；不再生成爻。
- 张掌：仅在 3D 状态下依据掌心位置和转角调整视角。
- V 手势：防抖后生成一爻；每次生成触发环带脉冲和当前爻视觉反馈。
- 手动按钮：保留“生成一爻”作为无摄像头时的备选。
- 六爻完成：自动进入 3D 展开，64 卦层锁定本卦扇区；右侧面板继续显示本卦、动爻和变卦。

## 场景结构

新 `luopan-scene` 模块接收 canvas，封装 renderer、camera、scene、动画循环和以下状态：

`dormant -> flat -> spatial`，握拳在 `flat` 与 `spatial` 之间切换；`dormant` 由食指或界面按钮进入 `flat`。场景 API 仅暴露 `awaken`、`toggleDepth`、`guide`、`castLine`、`revealHexagram`、`reset`、`resize` 与 `dispose`。

每一个环带使用独立 CanvasTexture 生成并贴到共用平面网格。所有层的半径固定，`spatial` 状态只插值各层预定义的 `z` 值；因此环带不会因手势导致缩放失配。

按从内到外的顺序绘制 14 层：

1. 天池太极
2. 先天八卦
3. 洛书九星
4. 二十四天星
5. 地盘正针
6. 穿山七十二龙
7. 人盘中针
8. 透地六十龙
9. 天盘缝针
10. 一百二十分金
11. 六十四卦
12. 二十八星宿
13. 二十四节气
14. 周天刻度

六十四卦层的扇区数据继续复用项目中既有的 King Wen 顺序。解析结果通过 `number` 映射到单一扇区，高亮材质和从中心指向该扇区的光束一起出现。

## 前端边界

- `luopan-data.ts`：14 层静态定义、传统文字列表、64 卦扇区和可测试的层级不变量。
- `luopan-state.ts`：纯状态转换与手势动作判定，不依赖 DOM 或 WebGL。
- `luopan-scene.ts`：Three.js、CanvasTexture、响应式分辨率、粒子和动画实现。
- `main.ts`：保持媒体识别、六爻和后端请求；把识别结果路由到场景 API。
- `index.html` / `styles.css`：在舞台添加 canvas，并保留右侧起卦控制台和 WebGL 不可用时的 CSS 降级画面。

不改变 FastAPI 路由、卦象数据格式或结果面板字段。

## 性能与降级

- 为窄屏、触控设备、低内存或 `prefers-reduced-motion` 降低纹理分辨率、粒子数、设备像素比和后处理强度。
- WebGL 初始化失败时保留现有二维罗盘和手动起卦能力，并显示简洁提示。
- 只在摄像头开启后启动手势推理；离开页面时释放 MediaPipe、WebGL 纹理、动画帧和摄像头轨道。

## 验证

- 先以单元测试锁定 14 层顺序、64 卦映射和状态转换。
- 前端执行 Vitest、TypeScript 检查和 Vite 生产构建；后端执行项目 `.venv` 下的 pytest。
- 使用浏览器检查桌面与手机画面、V 手势/手动成爻、握拳展开收回、六爻完成后的锁定高亮。
- 发布时继续用现有离线 Docker Compose 运行镜像，上传本次源码和 `frontend/dist`，然后校验 `https://ritual.qunxinjia.cn/health` 与新版静态资源。
