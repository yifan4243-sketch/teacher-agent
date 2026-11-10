# 提前PPTX原型来源

用户明确要求系统自动生成测试设计图片，人工固定样式图无需提供。

`blueprint.json` 记录课堂比较页的内容与提示词，依据项目完整授课稿范例中定位精度和重复定位精度的讲解。`generated-design.jpg` 是本会话实际调用生图工具生成的1672×941图像的JPEG编码副本。原始PNG超过仓库500KiB限制，保留在本机及生成源路径，不提交Git。

原始路径为 `D:\OpenAI\CodexHome\generated_images\01a1bb75-787c-7252-b913-99de3619aa5d\exec-4cd46e29-ceda-4abb-8bc4-7e772a14dd7e.png`。

`layout.json` 是开发者根据实际图片视觉测量的页面对象，作为提前验证的结构化输入。导出通过项目自己的通用原生PPTX渲染器完成。没有复制专有图片转代码Skill。

原生文字、圆形、线条和表格实际通过WPS打开、渲染、修改与保存。视觉布局适配器调用Hermes公开 `ctx.llm.complete_structured`，目前测试采用模拟模型。该样例没有证明产品自动生图到自动布局解析的全链路已经完成。
