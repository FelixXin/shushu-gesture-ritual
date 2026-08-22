# Shushu Gesture Ritual · 玄枢手势起卦

一个与原奇门知识库隔离的独立项目。第一阶段使用浏览器摄像头与 MediaPipe 手势识别，让用户通过“张掌唤醒、握拳成爻”完成六次起卦，并显示本卦、动爻与变卦。

## 已实现

- 浏览器摄像头授权与实时手部关键点叠加。
- `Open_Palm` 张掌唤醒、`Pointing_Up` 食指引盘、`Closed_Fist` 握拳确认一爻。
- 九宫、八卦、六十四卦同心圆盘与响应式动画。
- 三枚钱概率生成爻值：6/9 各为 1/8，7/8 各为 3/8。
- FastAPI 六十四卦解析接口，返回本卦、变卦和动爻。
- 无摄像头时可使用“手动生成一爻”完成流程。
- 摄像头画面仅在浏览器本地参与识别，不上传后端。

奇门时间排盘入口暂时禁用，待确认转盘/飞盘、拆补/置闰及真太阳时规则后接入。

## 本地启动

后端：

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/uvicorn app.main:app --app-dir backend --reload
```

前端另开一个终端：

```bash
cd frontend
pnpm install
pnpm dev
```

访问 `http://localhost:5173`。摄像头要求 HTTPS 或 localhost 安全上下文。

也可以使用 Docker：

```bash
docker compose up --build
```

## 验证

```bash
.venv/bin/python -m pytest backend/tests -q
cd frontend && pnpm test && pnpm build
```

## 接口

- `GET /health`
- `POST /api/v1/hexagrams/resolve`

请求体中的六个爻值按初爻到上爻排列：

```json
{"lines": [7, 8, 7, 8, 7, 8]}
```

当前目录不会自动创建 Git 仓库，远端地址和分支策略由使用者自行配置。
