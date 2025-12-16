<template>
	<view class="container">
		<!-- 页面标题区域 -->
		<view class="header-section">
			<view class="title-card">
				<text class="title">文章列表</text>
				<!-- 添加设置按钮 -->
				<view class="settings-icon" @click="showCategorySettings">
					<text>⚙️</text>
				</view>
			</view>
		</view>

		<!-- 分类订阅区域 -->
		<view class="category-section">
			<scroll-view class="category-scroll" scroll-x>
				<view class="category-list">
					<view v-for="(subscribed, category) in categorySubscriptions" :key="category"
						@click="toggleCategorySubscription(category)"
						:class="['category-item', { active: subscribed }]">
						<text class="category-name">{{ category }}</text>
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 内容区域 -->
		<view class="content-section">
			<scroll-view class="article-list-scroll" scroll-y>
				<!-- 分类文章列表 -->
				<view v-for="(articlesList, category) in categories" :key="category" class="category-group">
					<view class="category-header">
						<text class="category-title">{{ category }}</text>
					</view>

					<!-- 该分类下的文章 -->
					<view class="article-list">
						<!-- 已导入的文章 -->
						<view v-for="article in getArticlesByCategory(category)" :key="article.id"
							class="article-item-card imported">
							<view @click="navigateToDetail(article)" class="article-content">
								<text class="article-title">{{ article.title }}</text>
								<view class="article-meta">
									<view class="indicators">
										<text v-if="isBookmarked(article.id)" class="bookmark">📖</text>
										<text v-if="hasProgress(article.id)" class="progress">📍</text>
									</view>
								</view>
							</view>
							<view class="article-actions">
								<button @click.stop="showDeleteConfirm(article.id)"
									class="action-btn delete-btn">删除</button>
							</view>
						</view>

						<!-- 未导入的文章 -->
						<view v-for="fileName in getUnimportedArticles(category, articlesList)" :key="fileName"
							class="article-item-card not-imported">
							<view class="article-content">
								<text class="article-title">{{ fileName }}</text>
							</view>
							<view class="article-actions">
								<button @click.stop="downloadAndImportArticle(fileName, category)"
									class="action-btn download-btn">
									下载
								</button>
							</view>
						</view>
					</view>
				</view>

				<!-- 本地导入的文章 -->
				<!-- <view v-if="getLocalImportedArticles().length > 0" class="category-group">
					<view class="category-header">
						<text class="category-title">本地导入</text>
					</view>

					<view class="article-list">
						<view v-for="article in getLocalImportedArticles()" :key="article.id"
							class="article-item-card imported">
							<view @click="navigateToDetail(article)" class="article-content">
								<text class="article-title">{{ article.title }}</text>
								<view class="article-meta">
									<view class="indicators">
										<text v-if="isBookmarked(article.id)" class="bookmark">📖</text>
										<text v-if="hasProgress(article.id)" class="progress">📍</text>
									</view>
								</view>
							</view>
							<view class="article-actions">
								<button @click.stop="showDeleteConfirm(article.id)"
									class="action-btn delete-btn">删除</button>
							</view>
						</view>
					</view>
				</view> -->

				<!-- 空状态提示 -->
				<view v-if="getAllArticlesCount() === 0" class="empty-state">
					<text class="empty-text">暂无文章</text>
					<text class="empty-subtext">点击下方按钮导入文章</text>
				</view>
			</scroll-view>
		</view>

		<!-- 固定底部操作栏 -->
		<view class="fixed-bottom-bar">
			<view class="bottom-bar-container">
				<button @click="importArticle" class="main-action-btn">
					<text class="btn-text">导入文章</text>
				</button>
			</view>
		</view>

		<!-- 删除确认弹窗 -->
		<uni-popup ref="deletePopup" type="dialog">
			<uni-popup-dialog mode="base" title="确认删除" content="确定要删除这篇文章吗？" @confirm="confirmDelete"
				@cancel="cancelDelete">
			</uni-popup-dialog>
		</uni-popup>

		<!-- 分类订阅设置弹窗 -->
		<uni-popup ref="settingsPopup" type="center">
			<view class="settings-popup">
				<view class="popup-header">
					<text class="popup-title">分类订阅设置</text>
				</view>
				<scroll-view class="settings-content" scroll-y>
					<view v-for="(subscribed, category) in categorySubscriptions" :key="category" class="setting-item">
						<text class="category-label">{{ category }}</text>
						<switch :checked="subscribed"
							@change="e => toggleCategorySubscriptionPopup(category, e.detail.value)" />
					</view>
				</scroll-view>
				<view class="popup-footer">
					<button @click="closeSettings" class="close-btn">关闭</button>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import type UniPopup from '@dcloudio/uni-ui/lib/uni-popup/uni-popup.vue';
import config from "../../config";
// #ifdef H5
import JSZip from 'jszip';
// #endif

interface Article {
	id: string;
	title: string;
	content: string;
	category?: string; // 添加分类字段
}

interface CategorySubscription {
	[category: string]: boolean;
}

// 获取指定分类已导入的文章
const getArticlesByCategory = (category: string) => {
	return articles.value.filter(article => article.category === category);
};

// 获取指定分类未导入的文章
const getUnimportedArticles = (category: string, articlesList: string[]) => {
	// 获取已导入的文章标题
	const importedTitles = articles.value
		.filter(article => article.category === category)
		.map(article => article.title);

	// 返回未导入的文章
	return articlesList.filter(fileName => !importedTitles.includes(fileName));
};

// 获取本地导入的文章
const getLocalImportedArticles = () => {
	return articles.value.filter(article => article.category === "本地导入");
};

// 获取所有文章数量
const getAllArticlesCount = () => {
	// 计算所有分类中的文章数量（包括已导入和未导入的）
	let count = articles.value.length; // 已导入的文章

	// 加上未导入的文章
	for (const category in categories.value) {
		const articlesList = categories.value[category];
		const importedTitles = articles.value
			.filter(article => article.category === category)
			.map(article => article.title);

		const unimportedCount = articlesList.filter(fileName => !importedTitles.includes(fileName)).length;
		count += unimportedCount;
	}

	return count;
};

// 简单的YAML解析函数
const parseYaml = (yamlString: string): Record<string, string[]> => {
	const result: Record<string, string[]> = {};
	let currentCategory = "";

	const lines = yamlString.split('\n');

	for (const line of lines) {
		// 跳过空行和注释行
		if (line.trim() === "" || line.trim().startsWith('#')) continue;

		// 检查是否是分类（以冒号结尾）
		if (line.trim().endsWith(':')) {
			currentCategory = line.trim().slice(0, -1); // 移除冒号
			result[currentCategory] = [];
		}
		// 检查是否是文章条目（以短横线开头）
		else if (line.trim().startsWith('-') && currentCategory) {
			const articleName = line.trim().substring(1).trim(); // 移除短横线
			result[currentCategory].push(articleName);
		}
	}

	return result;
};

const articles = ref<Article[]>([]);
const categories = ref<Record<string, string[]>>({});
const categorySubscriptions = ref<CategorySubscription>({});
const deletePopup = ref<InstanceType<typeof UniPopup> | null>(null);
const settingsPopup = ref<InstanceType<typeof UniPopup> | null>(null);
const deletingArticleId = ref("");
const baseURL = ref(""); // 存储基础URL

// 计算订阅的文章
const subscribedArticles = computed(() => {
	// 如果没有订阅任何分类，显示所有文章
	const hasSubscriptions = Object.values(categorySubscriptions.value).some(subscribed => subscribed);
	if (!hasSubscriptions) {
		return articles.value;
	}

	// 只显示订阅分类的文章
	return articles.value.filter(article => {
		if (!article.category) return true; // 没有分类的文章总是显示
		return categorySubscriptions.value[article.category] || false;
	});
});

// 显示分类设置弹窗
const showCategorySettings = () => {
	settingsPopup.value?.open();
};

// 关闭分类设置弹窗
const closeSettings = () => {
	settingsPopup.value?.close();
};

// 在设置弹窗中切换分类订阅状态
const toggleCategorySubscriptionPopup = (category: string, subscribed: boolean) => {
	categorySubscriptions.value[category] = subscribed;
	saveCategorySubscriptions();
};

// 组件挂载时加载文章和分类
onMounted(() => {
	loadArticles();
	loadCategories();
	loadCategorySubscriptions();
});

// 加载文章
const loadArticles = () => {
	const savedArticles = uni.getStorageSync("articles");
	if (savedArticles && savedArticles.length > 0) {
		articles.value = savedArticles;
	} else {
		// 只有在没有保存的文章时才显示默认文章
		articles.value = [
			{ id: "1", title: "欢迎使用背诵应用", content: "请点击右下角的导入按钮来添加您的文章。", category: "本地导入" },
		];
	}
};

// 保存文章
const saveArticles = () => {
	uni.setStorageSync("articles", articles.value);
};

// 加载分类
const loadCategories = async () => {
	try {
		// 从URL获取分类数据
		baseURL.value = config.LIST_YAML.replace("list.yaml", "")
		const response = await fetch(config.LIST_YAML);
		const yamlText = await response.text();
		categories.value = parseYaml(yamlText);

		// 初始化分类订阅状态
		for (const category in categories.value) {
			if (!(category in categorySubscriptions.value)) {
				categorySubscriptions.value[category] = true; // 默认订阅所有分类
			}
		}

		// 确保"本地导入"分类始终存在
		if (!categories.value["本地导入"]) {
			categories.value["本地导入"] = [];
		}
	} catch (error) {
		console.error('加载分类失败:', error);
		// 如果无法从URL加载，使用默认分类
		categories.value = {
			"本地导入": []
		};

		// 初始化分类订阅状态
		for (const category in categories.value) {
			if (!(category in categorySubscriptions.value)) {
				categorySubscriptions.value[category] = true;
			}
		}
	}
};

// 下载并导入指定文章
const downloadAndImportArticle = async (fileName: string, category: string) => {
	try {
		// 显示加载提示
		uni.showLoading({
			title: '下载中...'
		});

		// 构建文章URL（与list.yaml在同一目录）
		const articleURL = `${baseURL.value}${encodeURIComponent(fileName)}`;

		// 下载文章
		const response = await fetch(articleURL);
		if (!response.ok) {
			throw new Error(`下载失败: ${response.status} ${response.statusText}`);
		}

		// 获取文章内容
		const content = await response.text();

		// 处理文章内容
		processFileContent(content, category, fileName);

		// 隐藏加载提示
		uni.hideLoading();

		uni.showToast({
			title: "下载成功",
			icon: "success"
		});
	} catch (error) {
		uni.hideLoading();
		console.error('下载文章失败:', error);
		uni.showToast({
			title: "下载失败",
			icon: "error"
		});
	}
};

// 加载分类订阅状态
const loadCategorySubscriptions = () => {
	const savedSubscriptions = uni.getStorageSync("categorySubscriptions");
	if (savedSubscriptions) {
		categorySubscriptions.value = savedSubscriptions;
	}
};

// 保存分类订阅状态
const saveCategorySubscriptions = () => {
	uni.setStorageSync("categorySubscriptions", categorySubscriptions.value);
};

// 切换分类订阅状态
const toggleCategorySubscription = (category: string) => {
	categorySubscriptions.value[category] = !categorySubscriptions.value[category];
	saveCategorySubscriptions();
};

// 导航到文章详情
const navigateToDetail = (article: Article) => {
	uni.navigateTo({
		url: `/pages/article-detail/article-detail?id=${article.id}`,
	});
};

// 导入文章
const importArticle = () => {
	uni.chooseFile({
		count: 1,
		type: "all",
		extension: [".txt", ".md", ".chm", ".zip"],
		success: (res) => {
			const filePath = res.tempFilePaths[0];
			const fileName = res.tempFiles[0].name || '';

			// 判断文件类型
			if (fileName.endsWith('.zip')) {
				// 处理ZIP文件
				handleZipFile(filePath);
			} else {
				// 处理普通文本文件
				handleTextFile(filePath, res.tempFiles[0]);
			}
		},
		fail: () => {
			uni.showToast({
				title: "选择文件失败",
				icon: "error",
			});
		},
	});
};

// 处理ZIP文件
const handleZipFile = (filePath: string) => {
	// #ifdef H5
	// 在H5平台上使用fetch而不是uni.getFileSystemManager
	fetch(filePath)
		.then(response => response.arrayBuffer())
		.then(arrayBuffer => {
			const zip = new JSZip();

			zip.loadAsync(arrayBuffer).then((zipContent) => {
				let entries = [] as { path: string, entry: JSZip.JSZipObject }[];
				zipContent.forEach((path, entry) => entries.push({
					path,
					entry
				}))
				const contents = entries.map(({ path, entry }) => {
					if (path.endsWith('.html') || entry.name.endsWith('.htm')) {
						// 先以二进制形式读取文件内容，以便进行编码检测
						return (zipContent.file(entry.name)!.async('uint8array').then((content) => {
							// 检测编码
							const detectedEncoding = detectEncodingFromHtml(content);

							// 使用检测到的编码解码内容
							let decodedContent = '';
							if (typeof TextDecoder !== 'undefined') {
								try {
									const decoder = new TextDecoder(detectedEncoding);
									decodedContent = decoder.decode(content);
								} catch (e) {
									// 解码失败，使用默认方式
									decodedContent = new TextDecoder().decode(content);
								}
							} else {
								// 不支持TextDecoder的环境，使用默认方式
								decodedContent = String.fromCharCode.apply(null, Array.from(content));
							}

							// 转换HTML为纯文本
							return convertHtmlToText(decodedContent);
						}))
					}
				});
				if (contents.length) {
					Promise.all(contents).then((textContents) => {
						processFileContent(textContents.join("\n"), "本地导入");
					});
				}
			}).catch(() => {
				uni.showToast({
					title: "解析ZIP文件失败",
					icon: "error",
				});
			});
		})
		.catch(() => {
			uni.showToast({
				title: "读取ZIP文件失败",
				icon: "error",
			});
		});
	// #endif

	// #ifndef H5
	// 小程序平台保持原来的实现
	uni.getFileSystemManager().readFile({
		filePath,
		success: (res) => {
			const arrayBuffer = res.data as ArrayBuffer;
			const zip = new JSZip();

			zip.loadAsync(arrayBuffer).then((zipContent) => {
				// 查找第一个HTML文件
				let htmlFileName = '';

				zipContent.forEach((relativePath, zipEntry) => {
					if (zipEntry.name.endsWith('.html') || zipEntry.name.endsWith('.htm')) {
						htmlFileName = zipEntry.name;
					}
				});

				if (htmlFileName) {
					// 先以二进制形式读取文件内容，以便进行编码检测
					zipContent.file(htmlFileName)?.async('uint8array').then((content) => {
						// 检测编码
						const detectedEncoding = detectEncodingFromHtml(content);

						// 使用检测到的编码解码内容
						let decodedContent = '';
						if (typeof TextDecoder !== 'undefined') {
							try {
								const decoder = new TextDecoder(detectedEncoding);
								decodedContent = decoder.decode(content);
							} catch (e) {
								// 解码失败，使用默认方式
								decodedContent = new TextDecoder().decode(content);
							}
						} else {
							// 不支持TextDecoder的环境，使用默认方式
							decodedContent = String.fromCharCode.apply(null, Array.from(content));
						}

						// 转换HTML为纯文本
						const textContent = convertHtmlToText(decodedContent);
						processFileContent(textContent, "本地导入");
					});
				} else {
					uni.showToast({
						title: "ZIP中未找到HTML文件",
						icon: "error",
					});
				}
			}).catch(() => {
				uni.showToast({
					title: "解析ZIP文件失败",
					icon: "error",
				});
			});
		},
		fail: () => {
			uni.showToast({
				title: "读取ZIP文件失败",
				icon: "error",
			});
		}
	});
	// #endif
};

// 检测HTML内容编码的辅助函数
const detectEncodingFromHtml = (content: Uint8Array): string => {
	// 将前1024字节转换为字符串以查找meta标签
	const previewLength = Math.min(content.length, 1024);
	const previewArray = content.slice(0, previewLength);
	// 修复类型转换问题
	const previewString = new TextDecoder().decode(previewArray);

	// 查找<meta charset="..."> 或 <meta http-equiv="Content-Type" content="text/html; charset=...">
	const charsetMeta = previewString.match(/<meta[^>]+charset\s*=\s*["']?([^"'>\s]+)/i) ||
		previewString.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^"'>\s]+)/i);

	if (charsetMeta && charsetMeta[1]) {
		return charsetMeta[1].toLowerCase();
	}

	// 默认返回utf-8
	return 'utf-8';
};

// HTML转文本函数
const convertHtmlToText = (html: string): string => {
	try {
		// 创建一个临时div来解析HTML
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = html;

		// 提取纯文本内容
		let textContent = tempDiv.textContent || tempDiv.innerText || '';

		// 移除多余的空白行，保留段落结构
		textContent = textContent.replace(/\n\s*\n\s*\n/g, '\n\n');
		textContent = textContent.trim();

		return textContent;
	} catch (e) {
		// 编码转换失败，回退到原始方法
		console.warn('HTML编码转换失败，使用原始方法:', e);
		return html.replaceAll(/<[^>]+>/g, '');
	}
}

// 处理文本文件
const handleTextFile = (filePath: string, file: any) => {
	// #ifdef H5
	// H5平台使用FileReader
	if (file) {
		readFileWithEncoding(file);
	} else {
		// 如果没有直接访问到File对象，则通过fetch获取
		fetch(filePath)
			.then(response => response.arrayBuffer())
			.then(arrayBuffer => {
				// 尝试不同编码解码
				tryDecodeText(arrayBuffer);
			})
			.catch(() => {
				uni.showToast({
					title: "读取文件失败",
					icon: "error",
				});
			});
	}
	// #endif

	// #ifndef H5
	// 小程序平台使用getFileSystemManager
	const fs = uni.getFileSystemManager();
	fs.readFile({
		filePath,
		encoding: "utf8",
		success: (readRes) => {
			const content = readRes.data as string;
			processFileContent(content, "本地导入");
		},
		fail: () => {
			uni.showToast({
				title: "读取文件失败",
				icon: "error",
			});
		},
	});
	// #endif
};

// #ifdef H5
const tryDecodeText = (arrayBuffer: ArrayBuffer) => {
	// 尝试UTF-8解码
	const utf8Decoder = new TextDecoder('utf-8');
	const utf8Text = utf8Decoder.decode(arrayBuffer);

	if (isValidChineseText(utf8Text)) {
		processFileContent(utf8Text, "本地导入");
		return;
	}

	// 尝试GBK解码
	try {
		const gbkDecoder = new TextDecoder('gbk');
		const gbkText = gbkDecoder.decode(arrayBuffer);

		if (isValidChineseText(gbkText)) {
			processFileContent(gbkText, "本地导入");
			return;
		}
	} catch (e) {
		// GBK解码失败，继续尝试其他编码
	}

	// 尝试GB2312解码
	try {
		const gb2312Decoder = new TextDecoder('gb2312');
		const gb2312Text = gb2312Decoder.decode(arrayBuffer);

		if (isValidChineseText(gb2312Text)) {
			processFileContent(gb2312Text, "本地导入");
			return;
		}
	} catch (e) {
		// GB2312解码失败
	}

	// 如果都失败，使用默认UTF-8解码并提示可能存在问题
	processFileContent(utf8Text, "本地导入");
	uni.showToast({
		title: "文件可能编码不匹配",
		icon: "none",
		duration: 3000
	});
};

const readFileWithEncoding = (file: File) => {
	// 首先尝试UTF-8
	const utf8Reader = new FileReader();
	utf8Reader.onload = (e) => {
		const content = e.target?.result as string;
		if (isValidChineseText(content)) {
			processFileContent(content, "本地导入");
		} else {
			// UTF-8失败，尝试GBK解码
			tryGBKDecoding(file);
		}
	};
	utf8Reader.readAsText(file, 'UTF-8');
};

const tryGBKDecoding = (file: File) => {
	if (typeof TextDecoder !== 'undefined') {
		// 使用TextDecoder进行GBK解码
		const arrayBufferReader = new FileReader();
		arrayBufferReader.onload = (e) => {
			const arrayBuffer = e.target?.result as ArrayBuffer;
			try {
				const decoder = new TextDecoder('gbk');
				const content = decoder.decode(arrayBuffer);
				if (isValidChineseText(content)) {
					processFileContent(content, "本地导入");
				} else {
					// 尝试GB2312
					const decoder2312 = new TextDecoder('gb2312');
					const content2312 = decoder2312.decode(arrayBuffer);
					if (isValidChineseText(content2312)) {
						processFileContent(content2312, "本地导入");
					} else {
						showEncodingError();
					}
				}
			} catch (error) {
				showEncodingError();
			}
		};
		arrayBufferReader.readAsArrayBuffer(file);
	} else {
		// 不支持TextDecoder的浏览器，提示用户转换文件编码
		uni.showToast({
			title: "请将文件转换为UTF-8编码",
			icon: "none",
		});
	}
};

const showEncodingError = () => {
	uni.showToast({
		title: "文件编码不支持，请转换为UTF-8",
		icon: "none",
	});
};
// #endif

const isValidChineseText = (text: string): boolean => {
	// 检测是否包含有效的中文字符
	const chineseChars = text.match(/[\u4e00-\u9fff]/g);
	const totalChars = text.replace(/\s/g, '').length;

	// 如果中文字符占比超过15%，认为是有效的中文文本
	return chineseChars && (chineseChars.length / totalChars > 0.15);
};

// 处理文件内容
const processFileContent = (content: string, category: string = "本地导入", fileName?: string) => {
	const lines = content.split("\n");
	const title = fileName || lines[0].trim();
	const body = lines.slice(1).join("\n").trim();

	const newArticle: Article = {
		id: Date.now().toString(),
		title,
		content: body,
		category // 添加分类信息
	};

	articles.value.push(newArticle);
	saveArticles();

	uni.showToast({
		title: "导入成功",
		icon: "success",
	});
};

const isBookmarked = (articleId: string) => {
	const bookmarks = uni.getStorageSync("bookmarks") || [];
	return bookmarks.some((b: any) => b.articleId === articleId);
};

const hasProgress = (articleId: string) => {
	const progress = uni.getStorageSync("readingProgress") || {};
	return progress[articleId] > 0;
};

const showDeleteConfirm = (id: string) => {
	deletingArticleId.value = id;
	deletePopup.value?.open(); // Add optional chaining
};

const confirmDelete = () => {
	if (deletingArticleId.value) {
		articles.value = articles.value.filter(article => article.id !== deletingArticleId.value);
		saveArticles();
		uni.showToast({
			title: "删除成功",
			icon: "success"
		});
	}
	deletingArticleId.value = "";
};

const cancelDelete = () => {
	deletingArticleId.value = "";
};
</script>

<style lang="less" scoped>
.container {
	height: 100vh;
	display: flex;
	flex-direction: column;
	background-color: #f5f6f8;
	padding-bottom: 140rpx;
	/* 为底部固定栏留出空间 */
}

/* 标题区域样式 */
.header-section {
	padding: 20rpx;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.1);
	position: relative;
}

.title-card {
	background: transparent;
	border-radius: 16rpx;
	padding: 30rpx 20rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.title {
	font-size: 36rpx;
	font-weight: bold;
	color: white;
	line-height: 1.4;
}

.settings-icon {
	font-size: 36rpx;
	color: white;
	cursor: pointer;
	padding: 10rpx;
}

/* 分类区域样式 */
.category-section {
	padding: 20rpx;
	background-color: #ffffff;
	border-bottom: 1rpx solid #eee;
}

.category-scroll {
	width: 100%;
	white-space: nowrap;
}

.category-list {
	display: inline-block;
}

.category-item {
	display: inline-block;
	padding: 16rpx 24rpx;
	margin-right: 20rpx;
	background-color: #f0f0f0;
	border-radius: 32rpx;
	font-size: 28rpx;
	color: #666;
	transition: all 0.3s ease;
}

.category-item.active {
	background: linear-gradient(90deg, #007aff, #00d4ff);
	color: white;
}

.category-name {
	display: block;
}

/* 内容区域样式 */
.content-section {
	flex: 1;
	padding: 20rpx;
	overflow: hidden;
}

.article-list-scroll {
	height: 100%;
}

.article-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.article-item-card {
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
	overflow: hidden;
	transition: all 0.3s ease;
}

.article-item-card:hover {
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.12);
	transform: translateY(-2rpx);
}

.article-content {
	padding: 30rpx;
	cursor: pointer;
}

.article-title {
	font-size: 32rpx;
	color: #333;
	line-height: 1.4;
	display: block;
	margin-bottom: 10rpx;
	word-break: break-word;
}

.article-meta {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.article-category {
	font-size: 24rpx;
	color: #007aff;
	background-color: rgba(0, 122, 255, 0.1);
	padding: 4rpx 12rpx;
	border-radius: 8rpx;
}

.indicators {
	display: flex;
	gap: 10rpx;
}

.bookmark {
	color: #ff9500;
	font-size: 28rpx;
}

.progress {
	color: #34c759;
	font-size: 28rpx;
}

.article-actions {
	display: flex;
	justify-content: flex-end;
	padding: 0 20rpx 20rpx;
}

.action-btn {
	padding: 0 24rpx;
	height: 56rpx;
	line-height: 56rpx;
	border-radius: 8rpx;
	font-size: 26rpx;
	border: none;
}

.delete-btn {
	background-color: #ff3b30;
	color: white;
}

/* 空状态样式 */
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 100rpx 0;
}

.empty-text {
	font-size: 32rpx;
	color: #999;
	margin-bottom: 20rpx;
}

.empty-subtext {
	font-size: 28rpx;
	color: #ccc;
}

/* 固定底部操作栏 */
.fixed-bottom-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 20rpx;
	background: #ffffff;
	box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.1);
	z-index: 999;
}

.bottom-bar-container {
	max-width: 750rpx;
	margin: 0 auto;
}

.main-action-btn {
	width: 100%;
	background: linear-gradient(90deg, #007aff, #00d4ff);
	color: white;
	padding: 20rpx 0;
	border-radius: 16rpx;
	font-size: 32rpx;
	font-weight: bold;
	border: none;
	box-shadow: 0 4rpx 16rpx rgba(0, 122, 255, 0.3);
}

.btn-text {
	display: block;
}

/* 响应式设计 */
@media (min-width: 768px) {
	.container {
		max-width: 750rpx;
		margin: 0 auto;
	}

	.header-section {
		border-radius: 0 0 16rpx 16rpx;
	}

	.fixed-bottom-bar {
		max-width: 750rpx;
		left: 50%;
		transform: translateX(-50%);
	}
}

/* 分类组样式 */
.category-group {
	margin-bottom: 40rpx;
}

.category-header {
	padding: 20rpx;
	background-color: #f0f0f0;
	border-radius: 8rpx;
	margin-bottom: 20rpx;
}

.category-title {
	font-size: 30rpx;
	font-weight: bold;
	color: #333;
}

/* 已导入文章卡片样式 */
.article-item-card.imported {
	border-left: 8rpx solid #007aff;
}

/* 未导入文章卡片样式 */
.article-item-card.not-imported {
	border-left: 8rpx solid #ff9500;
	opacity: 0.8;
}

/* 下载按钮样式 */
.download-btn {
	background-color: #007aff;
	color: white;
}

/* 设置弹窗样式 */
.settings-popup {
	width: 80%;
	background: #fff;
	border-radius: 16rpx;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
}

.popup-header {
	padding: 30rpx;
	text-align: center;
	border-bottom: 1rpx solid #eee;
}

.popup-title {
	font-size: 32rpx;
	font-weight: bold;
	color: #333;
}

.settings-content {
	flex: 1;
	padding: 20rpx;
	max-height: 60vh;
}

.setting-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 20rpx;
	border-bottom: 1rpx solid #f0f0f0;
}

.category-label {
	font-size: 28rpx;
	color: #333;
}

.popup-footer {
	padding: 20rpx;
	text-align: center;
	border-top: 1rpx solid #eee;
}

.close-btn {
	background: #007aff;
	color: white;
	padding: 15rpx 30rpx;
	border-radius: 8rpx;
	font-size: 28rpx;
	border: none;
}
</style>