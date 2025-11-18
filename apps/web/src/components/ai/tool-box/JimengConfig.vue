<script setup lang="ts">
import { Info } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const emit = defineEmits([`saved`])

const jimengConfig = ref({
  accessKeyId: localStorage.getItem(`jimeng_access_key_id`) || ``,
  secretAccessKey: localStorage.getItem(`jimeng_secret_access_key`) || ``,
  reqKey: localStorage.getItem(`jimeng_req_key`) || `jimeng_high_aes_general_v21_L`,
})

const loading = ref(false)
const testResult = ref(``)

const reqKeyOptions = [
  { label: `即梦高级通用 v2.1 (推荐)`, value: `jimeng_high_aes_general_v21_L` },
  { label: `即梦高级通用 v2.0`, value: `jimeng_high_aes_general_v20` },
]

function saveConfig() {
  if (!jimengConfig.value.accessKeyId.trim() || !jimengConfig.value.secretAccessKey.trim()) {
    testResult.value = `AccessKey ID 和 Secret Access Key 不能为空`
    return
  }

  localStorage.setItem(`jimeng_access_key_id`, jimengConfig.value.accessKeyId)
  localStorage.setItem(`jimeng_secret_access_key`, jimengConfig.value.secretAccessKey)
  localStorage.setItem(`jimeng_req_key`, jimengConfig.value.reqKey)

  testResult.value = `配置已保存`
  emit(`saved`)
}

function clearConfig() {
  localStorage.removeItem(`jimeng_access_key_id`)
  localStorage.removeItem(`jimeng_secret_access_key`)
  localStorage.removeItem(`jimeng_req_key`)

  jimengConfig.value = {
    accessKeyId: ``,
    secretAccessKey: ``,
    reqKey: `jimeng_high_aes_general_v21_L`,
  }

  testResult.value = `配置已清除`
}

async function testConnection() {
  if (!jimengConfig.value.accessKeyId.trim() || !jimengConfig.value.secretAccessKey.trim()) {
    testResult.value = `请先填写 AccessKey ID 和 Secret Access Key`
    return
  }

  testResult.value = ``
  loading.value = true

  try {
    const { jimengRequest } = await import(`./jimeng`)
    const result = await jimengRequest({
      accessKeyId: jimengConfig.value.accessKeyId,
      secretAccessKey: jimengConfig.value.secretAccessKey,
      reqKey: jimengConfig.value.reqKey,
      imageUrls: [],
      prompt: `test connection`,
    })

    if (result.code === 200) {
      const data = JSON.parse(result.body)
      if (data.code === 10000) {
        testResult.value = `连接成功！API密钥配置正确`
      }
      else {
        testResult.value = `连接失败: ${data.message || `未知错误`} (code: ${data.code})`
      }
    }
    else {
      testResult.value = `连接失败: HTTP ${result.code}`
    }
  }
  catch (error) {
    testResult.value = `连接失败: ${(error as Error).message}`
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-4 max-w-full">
    <div class="text-lg font-semibold border-b pb-2">
      即梦API配置
    </div>

    <!-- AccessKey ID -->
    <div>
      <Label class="mb-1 block text-sm font-medium">AccessKey ID</Label>
      <Input
        v-model="jimengConfig.accessKeyId"
        type="text"
        class="w-full mt-1 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
        placeholder="请输入 AccessKey ID"
      />
    </div>

    <!-- Secret Access Key -->
    <div>
      <Label class="mb-1 block text-sm font-medium">Secret Access Key</Label>
      <PasswordInput
        v-model="jimengConfig.secretAccessKey"
        class="w-full mt-1 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
        placeholder="请输入 Secret Access Key"
      />
    </div>

    <!-- 模型版本 -->
    <div>
      <Label class="mb-1 block text-sm font-medium">模型版本</Label>
      <Select v-model="jimengConfig.reqKey">
        <SelectTrigger class="w-full">
          <SelectValue>
            {{ reqKeyOptions.find(opt => opt.value === jimengConfig.reqKey)?.label || jimengConfig.reqKey }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in reqKeyOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- 说明 -->
    <div class="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
      <Info class="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
      <div class="text-blue-700 dark:text-blue-300">
        <p class="font-medium mb-1">
          如何获取API密钥？
        </p>
        <ol class="list-decimal list-inside space-y-1 text-xs">
          <li>访问 <a href="https://console.volcengine.com/iam/keymanage/" target="_blank" class="underline">火山引擎控制台</a></li>
          <li>创建或查看你的 AccessKey</li>
          <li>复制 AccessKey ID 和 Secret Access Key</li>
        </ol>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex flex-wrap gap-2">
      <Button
        type="button"
        class="flex-1 min-w-[100px]"
        @click="saveConfig"
      >
        保存配置
      </Button>
      <Button
        variant="outline"
        type="button"
        class="flex-1 min-w-[80px]"
        @click="clearConfig"
      >
        清空
      </Button>
      <Button
        size="sm"
        variant="outline"
        class="flex-1 min-w-[100px]"
        :disabled="loading"
        @click="testConnection"
      >
        {{ loading ? '测试中...' : '测试连接' }}
      </Button>
    </div>

    <!-- 测试结果显示 -->
    <div v-if="testResult" class="mt-1 text-xs" :class="testResult.includes('成功') || testResult.includes('已保存') || testResult.includes('已清除') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
      {{ testResult }}
    </div>
  </div>
</template>
