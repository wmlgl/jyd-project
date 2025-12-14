<template>
	<view class="container">
		<!-- 页面标题区域 -->
		<view class="header-section">
			<view class="title-card">
				<text class="title">文章列表</text>
			</view>
		</view>

		<!-- 内容区域 -->
		<view class="content-section">
			<scroll-view class="article-list-scroll" scroll-y>
				<view class="article-list">
					<view v-for="article in articles" :key="article.id" class="article-item-card">
						<view @click="navigateToDetail(article)" class="article-content">
							<text class="article-title">{{ article.title }}</text>
							<view class="indicators">
								<text v-if="isBookmarked(article.id)" class="bookmark">📖</text>
								<text v-if="hasProgress(article.id)" class="progress">📍</text>
							</view>
						</view>
						<view class="article-actions">
							<button @click.stop="showDeleteConfirm(article.id)" class="action-btn delete-btn">删除</button>
						</view>
					</view>
				</view>
				
				<!-- 空状态提示 -->
				<view v-if="articles.length === 0" class="empty-state">
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
			<uni-popup-dialog 
				mode="base" 
				title="确认删除" 
				content="确定要删除这篇文章吗？" 
				@confirm="confirmDelete"
				@cancel="cancelDelete">
			</uni-popup-dialog>
		</uni-popup>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type UniPopup from '@dcloudio/uni-ui/lib/uni-popup/uni-popup.vue';
// #ifdef H5
import JSZip from 'jszip';
// #endif

interface Article {
	id: string;
	title: string;
	content: string;
}

const articles = ref<Article[]>([]);
const deletePopup = ref<InstanceType<typeof UniPopup> | null>(null);
const deletingArticleId = ref("");

// 组件挂载时加载文章
onMounted(() => {
	loadArticles();
});

const loadArticles = () => {
	const savedArticles = uni.getStorageSync("articles");
	if (savedArticles && savedArticles.length > 0) {
		articles.value = savedArticles;
	} else {
		// 只有在没有保存的文章时才显示默认文章
		articles.value = [
			{ id: "1", title: "欢迎使用背诵应用", content: "请点击右下角的导入按钮来添加您的文章。" },
		];
	}
};

const saveArticles = () => {
	uni.setStorageSync("articles", articles.value);
};

const navigateToDetail = (article: Article) => {
	uni.navigateTo({
		url: `/pages/article-detail/article-detail?id=${article.id}`,
	});
};

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

// 新增处理ZIP文件的函数
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
						processFileContent(textContents.join("\n"));
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
						processFileContent(textContent);
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

// 新增HTML转文本函数
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
			processFileContent(content);
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
		processFileContent(utf8Text);
		return;
	}

	// 尝试GBK解码
	try {
		const gbkDecoder = new TextDecoder('gbk');
		const gbkText = gbkDecoder.decode(arrayBuffer);

		if (isValidChineseText(gbkText)) {
			processFileContent(gbkText);
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
			processFileContent(gb2312Text);
			return;
		}
	} catch (e) {
		// GB2312解码失败
	}

	// 如果都失败，使用默认UTF-8解码并提示可能存在问题
	processFileContent(utf8Text);
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
			processFileContent(content);
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
					processFileContent(content);
				} else {
					// 尝试GB2312
					const decoder2312 = new TextDecoder('gb2312');
					const content2312 = decoder2312.decode(arrayBuffer);
					if (isValidChineseText(content2312)) {
						processFileContent(content2312);
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

const processFileContent = (content: string) => {
	const lines = content.split("\n");
	const title = lines[0].trim();
	const body = lines.slice(1).join("\n").trim();

	const newArticle: Article = {
		id: Date.now().toString(),
		title,
		content: body,
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
	padding-bottom: 140rpx; /* 为底部固定栏留出空间 */
}

/* 标题区域样式 */
.header-section {
	padding: 20rpx;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.1);
}

.title-card {
	background: transparent;
	border-radius: 16rpx;
	padding: 30rpx 20rpx;
}

.title {
	font-size: 36rpx;
	font-weight: bold;
	color: white;
	line-height: 1.4;
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
</style>