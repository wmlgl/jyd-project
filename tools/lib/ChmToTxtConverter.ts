import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { promisify } from "util";
import iconvLite from "iconv-lite";

const execPromise = promisify(exec);
const globPromise = glob;

/**
 * CHM转TXT工具类
 */
class ChmToTxtConverter {
	private verbose: boolean = false;

	/**
	 * 设置是否显示详细日志
	 * @param verbose 是否显示详细日志
	 */
	setVerbose(verbose: boolean): void {
		this.verbose = verbose;
	}

	/**
	 * 将CHM文件转换为TXT文本
	 * @param chmFilePath CHM文件路径
	 * @param outputDir 输出目录（可选，默认为CHM文件同目录）
	 * @returns Promise<string> 转换后的TXT文件路径
	 */
	async convert(chmFilePath: string, outputDir?: string): Promise<string> {
		// 检查文件是否存在
		if (!fs.existsSync(chmFilePath)) {
			throw new Error(`CHM文件不存在: ${chmFilePath}`);
		}

		// 检查文件扩展名
		if (path.extname(chmFilePath).toLowerCase() !== ".chm") {
			throw new Error("文件扩展名必须是.chm");
		}

		// 确定输出目录
		const chmDir = path.dirname(chmFilePath);
		const outputPath = outputDir || chmDir;

		// 确保输出目录存在
		if (!fs.existsSync(outputPath)) {
			fs.mkdirSync(outputPath, { recursive: true });
		}

		this.log(`正在处理文件: ${chmFilePath}`);

		// try {
		// 方法1: 尝试使用7z命令解压CHM文件
		const txtFilePath = await this.extractWith7z(chmFilePath, outputPath);
		this.log(`转换成功: ${txtFilePath}`);
		return txtFilePath;
		// } catch (error: any) {
		// 	this.log(`7z转换失败，尝试使用hh命令: ${error.message}`);
		// }
	}

	/**
	 * 跨平台路径转换
	 * @param pattern 路径模式
	 * @returns 转换后的路径
	 */
	normalizePathPattern(pattern: string): string {
		// 如果是Unix风格的路径（以/开头），在Windows上转换为Windows风格
		if (process.platform === "win32" && pattern.startsWith("/")) {
			// 将 /d/Downloads/... 转换为 D:/Downloads/...
			if (pattern.match(/^\/[a-zA-Z]\//)) {
				return pattern.charAt(1).toUpperCase() + ":" + pattern.substring(2);
			}
		}

		// 统一使用正斜杠
		return pattern.replace(/\\/g, "/");
	}

	/**
	 * 批量转换CHM文件
	 * @param pattern 文件匹配模式（支持通配符）
	 * @param outputDir 输出目录（可选）
	 * @returns Promise<string[]> 转换后的TXT文件路径数组
	 */
	async batchConvert(pattern: string, outputDir?: string): Promise<string[]> {
		// 跨平台路径转换
		pattern = this.normalizePathPattern(pattern);
		this.log(`开始批量转换，模式: ${pattern}`);

		// 使用glob查找匹配的文件
		const files = (await globPromise(pattern, { absolute: true })) as string[];

		if (files.length === 0) {
			this.log("未找到匹配的文件");
			return [];
		}

		this.log(`找到 ${files.length} 个文件`);

		const results: string[] = [];
		let successCount = 0;
		let failCount = 0;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const progress = `${i + 1}/${files.length}`;

			try {
				this.log(`[${progress}] 正在转换: ${path.basename(file)}`);
				const result = await this.convert(file, outputDir);
				results.push(result);
				successCount++;
			} catch (error: any) {
				this.log(`[${progress}] 转换失败: ${path.basename(file)} - ${error.message}`);
				failCount++;
			}
		}

		this.log(`批量转换完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
		return results;
	}

	/**
	 * 使用7z命令解压CHM文件
	 * @param chmFilePath CHM文件路径
	 * @param outputDir 输出目录
	 * @returns Promise<string> 转换后的TXT文件路径
	 */
	private async extractWith7z(chmFilePath: string, outputDir: string): Promise<string> {
		const chmBaseName = path.basename(chmFilePath, ".chm");
		const extractDir = path.join(outputDir, `${chmBaseName}_extracted`);

		// 使用7z解压CHM文件
		const command = `7z x "${chmFilePath}" -o"${extractDir}" -y`;

		try {
			await execPromise(command);
		} catch (error: any) {
			this.log(`7z解压失败: ${error.message}`);
		}

		// 合并所有HTML文件为一个TXT文件
		const txtFilePath = path.join(outputDir, `${chmBaseName}.txt`);
		await this.combineHtmlFiles(extractDir, txtFilePath);

		// 清理解压目录
		this.removeDirectory(extractDir);

		return txtFilePath;
	}

	/**
	 * 合并目录中的所有HTML文件为一个TXT文件
	 * @param extractDir 解压目录
	 * @param txtFilePath 输出TXT文件路径
	 */
	private async combineHtmlFiles(extractDir: string, txtFilePath: string): Promise<void> {
		const files = await globPromise("**/*.{htm,.html}", { cwd: extractDir });
		let combinedContent = "";

		if (!files.length) {
			throw Error(`未找到HTML文件: ${extractDir}`);
		}

		for (const file of files) {
			const filePath = path.join(extractDir, file);
			const stat = fs.statSync(filePath);

			// 只处理HTML文件
			if (stat.isFile() && (file.toLowerCase().endsWith(".html") || file.toLowerCase().endsWith(".htm"))) {
				const content = this.readHtmlFileWithEncodingDetection(filePath);
				const textContent = this.htmlToText(content);
				// combinedContent += `\n\n=== ${file} ===\n\n${textContent}`;
				combinedContent += `\n\n${textContent}`;
			}
		}

		// 写入TXT文件
		fs.writeFileSync(txtFilePath, combinedContent, "utf-8");
	}

	/**
	 * 读取HTML文件并自动检测编码
	 * @param filePath 文件路径
	 * @returns UTF-8编码的字符串
	 */
	private readHtmlFileWithEncodingDetection(filePath: string): string {
		// 先读取文件buffer
		const buffer = fs.readFileSync(filePath);

		// 尝试从meta标签中探测编码
		const encoding = this.detectEncodingFromMeta(buffer);

		if (encoding && encoding.toLowerCase() !== "utf-8") {
			try {
				// 使用iconv-lite进行编码转换
				return iconvLite.decode(buffer, encoding);
			} catch (error) {
				this.log(`编码转换失败 (${encoding}): ${filePath}, 尝试使用默认编码`);
				throw error;
			}
		}

		// 如果无法检测到编码或转换失败，尝试使用默认编码
		try {
			return buffer.toString("utf-8");
		} catch (error) {
			// 如果UTF-8失败，尝试GBK
			try {
				const iconv = require("iconv-lite");
				return iconv.decode(buffer, "gbk");
			} catch (error2) {
				this.log(`所有编码尝试失败: ${filePath}`);
				// 最后尝试使用latin1编码
				return buffer.toString("latin1");
			}
		}
	}

	/**
	 * 从HTML文件的meta标签中探测编码
	 * @param buffer 文件buffer
	 * @returns 检测到的编码名称，如果没有检测到则返回null
	 */
	private detectEncodingFromMeta(buffer: Buffer): string | null {
		// 将buffer转换为字符串（使用latin1编码以避免字符丢失）
		const content = buffer.toString("latin1");

		// 查找meta标签中的charset属性
		const charsetMatch = content.match(/<meta[^>]*charset\s*=\s*["']?([^"'>\s]+)["']?[^>]*>/i);
		if (charsetMatch) {
			const charset = charsetMatch[1].toLowerCase();
			// this.log(`检测到编码: ${charset}`);

			// 映射常见的编码名称
			const encodingMap: { [key: string]: string } = {
				gb2312: "gbk",
				gbk: "gbk",
				gb18030: "gb18030",
				big5: "big5",
				shift_jis: "shift_jis",
				"euc-jp": "euc-jp",
				"iso-8859-1": "latin1",
				"windows-1252": "latin1",
				"utf-8": "utf-8",
			};

			return encodingMap[charset] || charset;
		}

		// 查找http-equiv中的content-type
		const httpEquivMatch = content.match(/<meta[^>]*http-equiv\s*=\s*["']?content-type["']?[^>]*content\s*=\s*["']?[^"'>]*charset\s*=\s*([^"'>\s;]+)[^"'>]*["']?[^>]*>/i);
		if (httpEquivMatch) {
			const charset = httpEquivMatch[1].toLowerCase();
			this.log(`检测到编码(HTTP-EQUIV): ${charset}`);

			const encodingMap: { [key: string]: string } = {
				gb2312: "gbk",
				gbk: "gbk",
				gb18030: "gb18030",
				big5: "big5",
				shift_jis: "shift_jis",
				"euc-jp": "euc-jp",
				"iso-8859-1": "latin1",
				"windows-1252": "latin1",
				"utf-8": "utf-8",
			};

			return encodingMap[charset] || charset;
		}

		return null;
	}

	/**
	 * 将HTML内容转换为纯文本
	 * @param html HTML内容
	 * @returns 纯文本内容
	 */
	private htmlToText(html: string): string {
		// 移除HTML标签
		let text = html.replace(/<[^>]*>/g, "");

		// 解码HTML实体
		text = text
			.replace(/&nbsp;/g, " ")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
			.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

		// 移除多余的空白行
		text = text.replace(/\n\s*\n\s*\n/g, "\n\n");

		// 去除首尾空白
		return text.trim();
	}

	/**
	 * 递归删除目录
	 * @param dirPath 目录路径
	 */
	private removeDirectory(dirPath: string): void {
		if (fs.existsSync(dirPath)) {
			const files = fs.readdirSync(dirPath);

			for (const file of files) {
				const filePath = path.join(dirPath, file);
				const stat = fs.statSync(filePath);

				if (stat.isDirectory()) {
					this.removeDirectory(filePath);
				} else {
					fs.unlinkSync(filePath);
				}
			}

			fs.rmdirSync(dirPath);
		}
	}

	/**
	 * 检查系统是否有7z命令
	 * @returns Promise<boolean>
	 */
	async has7z(): Promise<boolean> {
		try {
			await execPromise("7z --help");
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * 检查系统是否有hh命令（Windows帮助编译器）
	 * @returns Promise<boolean>
	 */
	async hasHh(): Promise<boolean> {
		try {
			// 在Windows上检查hh.exe是否存在
			const { stdout } = await execPromise("where hh");
			return stdout.trim().length > 0;
		} catch {
			return false;
		}
	}

	/**
	 * 日志输出
	 * @param message 日志消息
	 */
	private log(message: string): void {
		// if (this.verbose) {
		console.log(`[CHM2TXT] ${message}`);
		// }
	}
}

export default ChmToTxtConverter;
export { ChmToTxtConverter };
