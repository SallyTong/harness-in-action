# AI 作业批改工具

拍照上传试卷，AI 自动批改标注。支持英语和数学。

## 快速开始

```bash
# 1. 安装依赖
cd apps/backend && pip install -r requirements.txt
cd ../frontend && npm install

# 2. 启动开发服务
cd ../..
bash scripts/dev.sh
```

打开 http://localhost:5173 ，点击「检测后端连接」确认前后端联通。

## 技术栈

React 19 + FastAPI + MySQL 8.4 + GLM-4V

## 文档

- [访谈摘要](docs/interview-summary.md)
- [CLAUDE.md](CLAUDE.md) — AI 辅助开发指南
