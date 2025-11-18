export interface ToolDefinition {
  type: `function`
  function: {
    name: string
    description: string
    parameters: {
      type: `object`
      properties: Record<string, any>
      required?: string[]
    }
  }
}

export const toolDefinitions: ToolDefinition[] = [
  {
    type: `function`,
    function: {
      name: `get_current_weather`,
      description: `获取给定地点的天气`,
      parameters: {
        type: `object`,
        properties: {
          location: {
            type: `string`,
            description: `地点的位置信息，比如杭州`,
          },
          unit: {
            type: `string`,
            enum: [`摄氏度`, `华氏度`],
          },
        },
        required: [`location`],
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `search_web`,
      description: `搜索今日头条或其他网络内容。输入关键词进行实时搜索，返回相关的文章、资讯等结果。`,
      parameters: {
        type: `object`,
        properties: {
          query: {
            type: `string`,
            description: `搜索的内容`,
          },
        },
        required: [`query`],
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `generate_article_outline`,
      description: `生成文章大纲的工具。当用户要求生成文章大纲、生成文章、生成公众号、内容规划、文章结构时使用此工具。返回包含主题、标题和内容的大纲数据。`,
      parameters: {
        type: `object`,
        properties: {
          topic: {
            type: `string`,
            description: `文章的主题或题目`,
          },
          style: {
            type: `string`,
            description: `文章风格，如：公众号文章、技术博客、新闻稿等`,
            enum: [`公众号文章`, `技术博客`, `新闻稿`, `教程`, `其他`],
          },
          length: {
            type: `string`,
            description: `文章长度，如：短篇、中等长度、长篇`,
            enum: [`短篇`, `中等长度`, `长篇`],
          },
        },
        required: [`topic`],
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `jimeng_set_api_key`,
      description: `设置火山引擎即梦API密钥。在使用图片生成功能之前必须先设置此密钥。当用户提供即梦API密钥时使用此工具。`,
      parameters: {
        type: `object`,
        properties: {
          access_key_id: {
            type: `string`,
            description: `火山引擎AccessKey ID`,
          },
          secret_access_key: {
            type: `string`,
            description: `火山引擎Secret Access Key（通常以==结尾）`,
          },
          req_key: {
            type: `string`,
            description: `模型版本，默认为 jimeng_high_aes_general_v21_L`,
            enum: [`jimeng_high_aes_general_v21_L`, `jimeng_high_aes_general_v20`],
          },
        },
        required: [`access_key_id`, `secret_access_key`],
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `image_generate`,
      description: `【必须使用】生成图片工具（使用火山引擎即梦AI）。当用户请求中包含以下任何关键词时，必须立即调用此工具：生成图片、创建图片、画图、设计图片、制作图片、图片、图像、图、画。此工具会根据用户的文字描述生成对应的图片。API密钥已配置，可以直接使用。不要询问用户，直接调用此工具。`,
      parameters: {
        type: `object`,
        properties: {
          prompt: {
            type: `string`,
            description: `图片的详细描述，必须包含用户要求的所有细节。例如：如果用户说'生成一个卡通的松鼠骑自行车的图片'，则 prompt 应该是'卡通的松鼠骑自行车'。如果用户说'生成2张动画松鼠骑自行车的动画卡通图片'，则 prompt 应该是'动画风格，松鼠骑自行车'。这是必填参数。`,
          },
          image_urls: {
            type: `array`,
            items: {
              type: `string`,
            },
            description: `参考图片URL数组（可选），用于图生图功能。如果用户提供了参考图片，可以传入此参数。`,
          },
        },
        required: [`prompt`],
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `image_remove_background`,
      description: `去除图片背景。当用户要求去除背景、移除背景、抠图、去掉背景时使用此工具。返回去除背景后的图片。`,
      parameters: {
        type: `object`,
        properties: {
          image_url: {
            type: `string`,
            description: `图片URL地址`,
          },
          image_base64: {
            type: `string`,
            description: `图片Base64编码（如果没有URL可使用此参数）`,
          },
        },
      },
    },
  },
  {
    type: `function`,
    function: {
      name: `image_variation`,
      description: `生成图片变体或拓展。当用户要求修改图片、生成变体、拓展图片、修改图片风格时使用此工具。返回变体或拓展后的图片。`,
      parameters: {
        type: `object`,
        properties: {
          image_url: {
            type: `string`,
            description: `原图片URL地址`,
          },
          image_base64: {
            type: `string`,
            description: `原图片Base64编码（如果没有URL可使用此参数）`,
          },
          prompt: {
            type: `string`,
            description: `变体描述或修改要求`,
          },
          strength: {
            type: `number`,
            description: `修改强度，0-1之间，默认0.7`,
          },
        },
      },
    },
  },
]
