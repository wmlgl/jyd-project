#!/usr/bin/env node

import ChmToTxtConverter from "./lib/ChmToTxtConverter.ts";

/**
 * 显示使用帮助
 */
function showHelp(): void {
	console.log(`
CHM转TXT工具

用法:
  chm2txt <文件模式> [选项]

选项:
  -o, --output <目录>     指定输出目录
  -v, --verbose          显示详细日志
  -h, --help             显示帮助信息

示例:
  chm2txt file.chm
  chm2txt *.chm
  chm2txt "**/*.chm" -o ./output
  chm2txt "docs/*.chm" --verbose
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
 * 主函数
 */
async function main(): Promise<void> {
	const { pattern, outputDir, verbose, help } = parseArgs();

	if (help) {
		showHelp();
		process.exit(0);
	}

	// 创建转换器实例
	const converter = new ChmToTxtConverter();
	converter.setVerbose(verbose);

	try {
		// 执行转换
		const results = await converter.batchConvert(pattern, outputDir);

		if (results.length > 0) {
			console.log(`\n转换完成！共处理 ${results.length} 个文件`);
			if (verbose) {
				console.log("输出文件列表:");
				results.forEach((file) => console.log(`  ${file}`));
			}
		} else {
			console.log("没有找到需要转换的文件");
		}
	} catch (error: any) {
		console.error("转换过程中发生错误:", error.message);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("程序执行出错:", error);
	process.exit(1);
});

export default ChmToTxtConverter;
