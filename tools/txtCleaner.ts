#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { promisify } from "util";

const globPromise = glob;

/**
 * 显示使用帮助
 */
function showHelp(): void {
	console.log(`
TXT文件内容清洗工具

用法:
  txtCleaner <文件模式> [选项]

选项:
  -o, --output <目录>     指定输出目录
  -v, --verbose          显示详细日志
  -h, --help             显示帮助信息

示例:
  txtCleaner file.txt
  txtCleaner *.txt
  txtCleaner "**/*.txt" -o ./cleaned
  txtCleaner "docs/*.txt" --verbose
  `);
}

/**
 * 解析命令行参数
 */
function parseArgs(): { pattern: string; outputDir?: string; verbose: boolean; help: boolean } {
	const args = process.argv.slice(2);
	const result = {
		pattern: "",
		outputDir: undefined as string | undefined,
		verbose: false,
		help: false,
	};

	// 如果没有参数，显示帮助
	if (args.length === 0) {
		result.help = true;
		return result;
	}

	// 解析参数
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		switch (arg) {
			case "-h":
			case "--help":
				result.help = true;
				return result;
			case "-v":
			case "--verbose":
				result.verbose = true;
				break;
			case "-o":
			case "--output":
				if (i + 1 < args.length) {
					result.outputDir = args[++i];
				} else {
					console.error("错误: -o/--output 参数需要指定目录");
					process.exit(1);
				}
				break;
			default:
				if (!result.pattern) {
					result.pattern = arg;
				} else {
					console.error(`错误: 未知参数 ${arg}`);
					process.exit(1);
				}
				break;
		}
	}

	// 如果没有指定文件模式，显示帮助
	if (!result.pattern) {
		result.help = true;
	}

	return result;
}

/**
 * 跨平台路径转换
 * @param pattern 路径模式
 * @returns 转换后的路径
 */
function normalizePathPattern(pattern: string): string {
	// 如果是Unix风格的路径（以/开头），在Windows上转换为Windows风格
	if (process.platform === 'win32' && pattern.startsWith('/')) {
		// 将 /d/Downloads/... 转换为 D:/Downloads/...
		if (pattern.match(/^\/[a-zA-Z]\//)) {
			return pattern.charAt(1).toUpperCase() + ':' + pattern.substring(2);
		}
	}
	
	// 统一使用正斜杠
	return pattern.replace(/\\/g, '/');
}

/**
 * 清洗文本内容，移除无效内容
 * @param content 原始文本内容
 * @returns 清洗后的文本内容
 */
function cleanTextContent(content: string): string {
	// 定义要移除的无效内容模式
	const patternsToRemove = [
		// 页面导航相关
		/上一页/g,
		/下一页/g,
		/首页/g,
		/末页/g,
		/第\d+页/g,
		/共\d+页/g,
		/页码[:：]?\d+/g,
		/[\d\-]+\/[\d\-]+/g, // 页码格式如 12-25
		
		// 链接相关
		/http[s]?:\/\/[^\s]*/g,
		/www\.[^\s]*/g,
		
		// 版权信息
		/.*原始.*来源[^\n]*/g,
		/版权所有[^\n]*/g,
		/Copyright[^\n]*/gi,
		/©[^\n]*/g,
		
		// 时间戳
		/\d{4}[年\-\/]\d{1,2}[月\-\/]\d{1,2}[日]?/g,
		/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/g,
		
		// 多余的空白行（超过2个换行符）
		/\n{3,}/g
	];

	// 应用所有清洗规则
	let cleanedContent = content;
	
	for (const pattern of patternsToRemove) {
		cleanedContent = cleanedContent.replace(pattern, "");
	}
	
	// 清理多余的空白行
	cleanedContent = cleanedContent.replace(/\n{3,}/g, "\n\n");
	
	// 去除首尾空白
	cleanedContent = cleanedContent.trim();
	
	return cleanedContent;
}

/**
 * 清洗单个TXT文件
 * @param filePath 文件路径
 * @param outputDir 输出目录（可选）
 * @param verbose 是否显示详细日志
 * @returns 清洗后的文件路径
 */
async function cleanTxtFile(filePath: string, outputDir?: string, verbose: boolean = false): Promise<string> {
	// 检查文件是否存在
	if (!fs.existsSync(filePath)) {
		throw new Error(`文件不存在: ${filePath}`);
	}

	// 检查文件扩展名
	if (path.extname(filePath).toLowerCase() !== ".txt") {
		throw new Error("文件扩展名必须是.txt");
	}

	// 确定输出目录
	const fileDir = path.dirname(filePath);
	const outputPath = outputDir || fileDir;

	// 确保输出目录存在
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	if (verbose) {
		console.log(`[TXTCLEANER] 正在处理文件: ${filePath}`);
	}

	try {
		// 读取文件内容
		const content = fs.readFileSync(filePath, "utf-8");
		
		// 清洗内容
		const cleanedContent = cleanTextContent(content);
		
		// 确定输出文件路径
		const fileName = path.basename(filePath);
		const cleanedFilePath = path.join(outputPath, fileName);
		
		// 写入清洗后的内容
		fs.writeFileSync(cleanedFilePath, cleanedContent, "utf-8");
		
		if (verbose) {
			console.log(`[TXTCLEANER] 清洗完成: ${cleanedFilePath}`);
		}
		
		return cleanedFilePath;
	} catch (error: any) {
		throw new Error(`清洗文件失败 ${filePath}: ${error.message}`);
	}
}

/**
 * 批量清洗TXT文件
 * @param pattern 文件匹配模式（支持通配符）
 * @param outputDir 输出目录（可选）
 * @param verbose 是否显示详细日志
 * @returns Promise<string[]> 清洗后的文件路径数组
 */
async function batchCleanTxtFiles(pattern: string, outputDir?: string, verbose: boolean = false): Promise<string[]> {
	// 标准化路径模式
	const normalizedPattern = normalizePathPattern(pattern);
	
	if (verbose) {
		console.log(`[TXTCLEANER] 开始批量清洗，原始模式: ${pattern}`);
		console.log(`[TXTCLEANER] 标准化模式: ${normalizedPattern}`);
	}

	// 使用glob查找匹配的文件
	let files: string[] = [];
	
	// 尝试多种方式查找文件
	const globOptions = { 
		absolute: true,
		nocase: true, // 忽略大小写
		windowsPathsNoEscape: true // Windows路径处理
	};
	
	try {
		files = (await globPromise(normalizedPattern, globOptions)) as string[];
	} catch (error: any) {
		if (verbose) {
			console.log(`[TXTCLEANER] glob模式匹配出错: ${error.message}`);
		}
		
		// 如果glob失败，尝试直接检查路径是否为具体文件
		if (fs.existsSync(normalizedPattern) && fs.statSync(normalizedPattern).isFile()) {
			files = [normalizedPattern];
			if (verbose) {
				console.log(`[TXTCLEANER] 直接使用文件路径: ${normalizedPattern}`);
			}
		} else {
			// 尝试检查目录下的所有txt文件
			try {
				const dirPath = normalizedPattern.endsWith('*.txt') ? 
					normalizedPattern.substring(0, normalizedPattern.length - 6) : 
					normalizedPattern;
					
				if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
					const dirFiles = fs.readdirSync(dirPath);
					files = dirFiles
						.filter(file => path.extname(file).toLowerCase() === '.txt')
						.map(file => path.join(dirPath, file));
					if (verbose) {
						console.log(`[TXTCLEANER] 直接扫描目录中的txt文件: ${dirPath}`);
					}
				}
			} catch (dirError: any) {
				if (verbose) {
					console.log(`[TXTCLEANER] 目录扫描也失败: ${dirError.message}`);
				}
			}
		}
	}

	if (files.length === 0) {
		if (verbose) {
			console.log("[TXTCLEANER] 未找到匹配的文件");
			// 提供一些调试建议
			console.log("[TXTCLEANER] 调试建议:");
			console.log("[TXTCLEANER] 1. 检查路径是否正确");
			console.log("[TXTCLEANER] 2. 确认目录中确实存在.txt文件");
			console.log("[TXTCLEANER] 3. 尝试使用绝对路径，例如: D:/Downloads/chm_out/*.txt");
		}
		return [];
	}

	if (verbose) {
		console.log(`[TXTCLEANER] 找到 ${files.length} 个文件`);
		if (files.length <= 10) {
			// 显示前10个文件路径
			files.forEach((file, index) => {
				console.log(`  ${index + 1}. ${file}`);
			});
		} else {
			// 显示前5个和后5个文件路径
			for (let i = 0; i < 5; i++) {
				console.log(`  ${i + 1}. ${files[i]}`);
			}
			console.log(`  ... (${files.length - 10} more files)`);
			for (let i = files.length - 5; i < files.length; i++) {
				console.log(`  ${i + 1}. ${files[i]}`);
			}
		}
	}

	const results: string[] = [];
	let successCount = 0;
	let failCount = 0;

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const progress = `${i + 1}/${files.length}`;

		try {
			if (verbose) {
				console.log(`[TXTCLEANER] [${progress}] 正在清洗: ${path.basename(file)}`);
			}
			const result = await cleanTxtFile(file, outputDir, verbose);
			results.push(result);
			successCount++;
		} catch (error: any) {
			if (verbose) {
				console.log(`[TXTCLEANER] [${progress}] 清洗失败: ${path.basename(file)} - ${error.message}`);
			}
			failCount++;
		}
	}

	if (verbose) {
		console.log(`[TXTCLEANER] 批量清洗完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
	}
	
	return results;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
	const { pattern, outputDir, verbose, help } = parseArgs();

	if (help) {
		showHelp();
		process.exit(0);
	}

	try {
		// 执行清洗
		const results = await batchCleanTxtFiles(pattern, outputDir, verbose);

		if (results.length > 0) {
			console.log(`\n清洗完成！共处理 ${results.length} 个文件`);
			if (verbose) {
				console.log("输出文件列表:");
				results.forEach((file) => console.log(`  ${file}`));
			}
		} else {
			console.log("没有找到需要清洗的文件");
		}
	} catch (error: any) {
		console.error("清洗过程中发生错误:", error.message);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("程序执行出错:", error);
	process.exit(1);
});