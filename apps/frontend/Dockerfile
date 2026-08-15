FROM node:22-alpine AS build

WORKDIR /app
COPY apps/frontend/package.json ./
RUN npm install
COPY apps/frontend/ ./
# 共享类型包（packages/api-types）在 apps/frontend 之外。tsconfig 的
# baseUrl="." 配 paths="../../packages/api-types/index.ts"、vite 别名同为
# "../../packages/api-types/index.ts"，故拷贝到容器内的 /packages/api-types。
COPY packages/api-types/ /packages/api-types/
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
