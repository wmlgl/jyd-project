# CHM转TXT工具

这是一个用于将CHM文件转换为TXT文本的工具，支持单个文件转换和批量转换。

## 功能特性

- 将单个CHM文件转换为TXT文本
- 支持通配符批量转换多个CHM文件
- 自动检测系统可用的解压工具（7z或hh）
- 支持自定义输出目录
- 提供详细的处理日志

## 安装依赖

在项目根目录下运行：

\`\`\`bash
npm install
\`\`\`

## 使用方法

### 作为模块使用

\`\`\`typescript
import ChmToTxtConverter from "./tools/lib/ChmToTxtConverter";

const converter = new ChmToTxtConverter();

// 转换单个文件
await converter.convert("path/to/file.chm");

// 批量转换（支持通配符）
await converter.batchConvert("path/to/*.chm");
\`\`\`

### 命令行使用

\`\`\`bash
# 转换单个文件
npx ts-node tools/chm2txt.ts file.chm

# 批量转换（使用通配符）
npx ts-node tools/chm2txt.ts "*.chm"

# 指定输出目录
npx ts-node tools/chm2txt.ts "*.chm" -o ./output

# 显示详细日志
npx ts-node tools/chm2txt.ts "*.chm" --verbose

# 显示帮助信息
npx ts-node tools/chm2txt.ts --help
\`\`\`

## 命令行参数

- \`<文件模式>\` - 要转换的CHM文件模式（支持通配符）
- \`-o, --output <目录>\` - 指定输出目录
- \`-v, --verbose\` - 显示详细日志
- \`-h, --help\` - 显示帮助信息

## 示例

\`\`\`bash
# 转换单个文件
npx ts-node tools/chm2txt.ts document.chm

# 转换当前目录下所有CHM文件
npx ts-node tools/chm2txt.ts "*.chm"

# 转换指定目录下的所有CHM文件，输出到指定目录
npx ts-node tools/chm2txt.ts "/path/to/chm/files/*.chm" -o ./txt-output

# 转换嵌套目录中的所有CHM文件
npx ts-node tools/chm2txt.ts "**/*.chm" --verbose
\`\`\`

## 系统要求

- Node.js 14+
- TypeScript 4.9+
- 7-Zip 或 Windows自带的hh命令（至少需要其中一个）

## 工作原理

1. 工具首先尝试使用7-Zip解压CHM文件
2. 如果7-Zip不可用，则尝试使用Windows自带的hh命令
3. 解压后提取所有HTML文件内容
4. 将HTML内容转换为纯文本
5. 合并所有文本内容到一个TXT文件中
