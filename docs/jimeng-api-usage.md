# 火山引擎即梦 AI 集成说明

## 概述

本项目已集成火山引擎即梦 AI 的图片生成功能，支持文生图和图生图两种模式。

## 功能特性

- ✅ 文生图：通过文字描述生成图片
- ✅ 图生图：基于参考图片和提示词生成新图片
- ✅ 安全认证：使用火山引擎标准的 HMAC-SHA256 签名认证
- ✅ 配置持久化：API 密钥自动保存到本地存储

## 使用方法

### 1. 获取 API 密钥

1. 访问 [火山引擎控制台](https://console.volcengine.com/iam/keymanage/)
2. 创建或查看你的 AccessKey
   - **AccessKey ID** (AK)
   - **Secret Access Key** (SK，通常以 `==` 结尾)

### 2. 配置 API 密钥

在 AI 助手对话中，发送以下消息配置密钥：

```
请帮我配置即梦API密钥：
access_key_id: YOUR_ACCESS_KEY_ID_HERE
secret_access_key: YOUR_SECRET_ACCESS_KEY_HERE
```

AI 助手会自动调用 `jimeng_set_api_key` 工具完成配置。

### 3. 生成图片

配置完成后，可以直接要求 AI 生成图片：

#### 文生图示例

```
请帮我生成一张图片：一只可爱的橘猫在阳光下的草地上玩耍
```

#### 图生图示例

```
基于这张图片 https://example.com/cat.jpg，生成一张卡通风格的图片
```

## API 参数说明

### jimeng_set_api_key 工具

设置火山引擎即梦 API 密钥。

**参数：**

- `access_key_id` (必填): 火山引擎 AccessKey ID
- `secret_access_key` (必填): 火山引擎 Secret Access Key
- `req_key` (可选): 模型版本，默认为 `jimeng_high_aes_general_v21_L`

### image_generate 工具

生成图片。

**参数：**

- `prompt` (必填): 图片描述文字
- `image_urls` (可选): 参考图片 URL 数组，用于图生图

## 支持的模型版本

- `jimeng_high_aes_general_v21_L` (默认): 即梦高级通用版本 v2.1
- `jimeng_high_aes_general_v20`: 即梦高级通用版本 v2.0

## 数据存储

API 密钥会安全地存储在浏览器的 localStorage 中：

- `jimeng_access_key_id`: AccessKey ID
- `jimeng_secret_access_key`: Secret Access Key
- `jimeng_req_key`: 模型版本

## 技术实现

- **认证方式**: HMAC-SHA256 签名
- **API 端点**: `https://visual.volcengineapi.com`
- **加密库**: crypto-js
- **签名实现**: `apps/web/src/components/ai/tool-box/jimeng.ts`

## 返回数据格式

成功响应：

```json
{
  "code": 10000,
  "message": "Success",
  "data": {
    "image_urls": ["https://..."]
  }
}
```

错误响应：

```json
{
  "code": 错误码,
  "message": "错误信息"
}
```

## 常见问题

### Q: 提示未配置 API 密钥怎么办？

A: 请先使用 AI 助手配置密钥，参考上面的"配置 API 密钥"部分。

### Q: 图片生成失败？

A: 检查以下几点：

1. API 密钥是否正确
2. 账号是否有足够的配额
3. 网络连接是否正常
4. 提示词是否符合要求（不能包含违规内容）

### Q: 如何修改默认模型版本？

A: 在配置密钥时指定 `req_key` 参数，或直接修改 localStorage 中的 `jimeng_req_key` 值。

## 相关链接

- [火山引擎即梦 AI 官网](https://www.volcengine.com/product/jimeng)
- [火山引擎控制台](https://console.volcengine.com/)
- [API 文档](https://www.volcengine.com/docs/6791/97889)
