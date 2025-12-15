# PWA配置说明

## 已配置的功能

1. **App Manifest** (`manifest.json`)
   - 应用名称和描述
   - 主题颜色和背景颜色
   - 图标配置
   - 显示模式设置为standalone

2. **Service Worker** (`sw.js`)
   - 资源缓存策略
   - 离线支持
   - 自动更新机制

3. **Cache Manifest** (`cache.manifest`)
   - 传统浏览器缓存支持
   - 资源列表管理

4. **离线页面** (`offline.html`)
   - 网络不可用时的友好提示

## 使用说明

1. **安装到桌面**：用户在支持PWA的浏览器中访问应用时，会看到"添加到主屏幕"的提示

2. **离线使用**：应用核心功能可以在离线状态下使用

3. **自动更新**：Service Worker会自动检查并更新缓存资源

## 开发和测试

- 在开发模式下，Service Worker可能不会生效
- 生产构建后，PWA功能将完全启用
- 使用Chrome DevTools的Application面板测试PWA功能