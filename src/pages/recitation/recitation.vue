<template>
	<view class="recitation-container">
		<!-- 头部信息 -->
		<view class="header">
			<text class="title">背诵练习</text>
			<view class="header-actions">
				<view class="sentence-progress">
					<text>{{ currentSentenceIndex + 1 }}/{{ sentences.length }}</text>
				</view>
				<button @click="showSettings = !showSettings" class="settings-btn">设置</button>
			</view>
		</view>

		<!-- 设置面板 -->
		<view v-if="showSettings" class="settings-panel">
			<view class="difficulty-selector">
				<text class="section-title">选择难度：</text>
				<view class="difficulty-buttons">
					<button @click="setDifficulty('easy')" :class="{ active: difficulty === 'easy' }"
						class="difficulty-btn">简单</button>
					<button @click="setDifficulty('medium')" :class="{ active: difficulty === 'medium' }"
						class="difficulty-btn">中等</button>
					<button @click="setDifficulty('hard')" :class="{ active: difficulty === 'hard' }"
						class="difficulty-btn">困难</button>
				</view>
			</view>
		</view>

		<!-- 拼音输入区域 -->
		<view v-if="showPinyinInput" class="pinyin-input-section">
			<text class="prompt">请输入 "{{ currentWord }}" 的拼音首字母：</text>
			<input v-model="pinyinInput" @confirm="checkPinyin" placeholder="例如: zh, ch, sh" class="pinyin-input" />
			<view class="input-actions">
				<button @click="checkPinyin" class="action-btn primary">确认</button>
				<button @click="skipWord" class="action-btn">跳过</button>
			</view>
		</view>

		<!-- 词语排序区域 -->
		<view v-if="!showPinyinInput" class="word-sorting-section">
			<view class="available-words">
				<text class="section-title">可用词语:</text>
				<view class="word-list">
					<text v-for="word in shuffledWords" :key="word" @click="addWord(word)" class="word-item">
						{{ word }}
					</text>
				</view>
			</view>

			<view class="user-order">
				<text class="section-title">你的顺序:</text>
				<view class="word-list">
					<text v-for="(word, index) in userOrder" :key="word" @click="removeWord(word)"
						:class="['word-item', 'user-word', { 'error-word': errorIndices.includes(index) }]">
						{{ word }}
					</text>
				</view>
			</view>
			<button @click="checkAnswer" class="check-answer-btn">检查答案</button>
		</view>

		<!-- 导航控制 -->
		<view class="navigation-controls">
			<button @click="prevSentence" :disabled="currentSentenceIndex === 0" class="nav-btn">上一句</button>
			<button @click="nextSentence" :disabled="currentSentenceIndex === sentences.length - 1"
				class="nav-btn">下一句</button>
			<button @click="skipWord" class="nav-btn skip-btn">跳过</button>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { pinyin } from 'pinyin-pro';
import { Segment, useDefault } from 'segmentit';

const planId = ref("");
const words = ref<string[]>([]);
const shuffledWords = ref<string[]>([]);
const userOrder = ref<string[]>([]);
const startTime = ref(0);
const difficulty = ref<'easy' | 'medium' | 'hard'>('easy');
const hiddenIndices = ref<number[]>([]);
const displayWords = ref<string[]>([]);
const showPinyinInput = ref(false);
const currentWordIndex = ref(-1);
const currentWord = ref("");
const pinyinInput = ref("");
const showSettings = ref(false);

// 新增：用于存储当前句子的正确顺序
const currentSentenceWords = ref<string[]>([]);

// 新增变量
const currentSentenceIndex = ref(0);
const sentences = ref<string[][]>([]); // 存储分割后的句子数组
const isCompleted = ref(false);

// 新增：用于存储错误词语的索引
const errorIndices = ref<number[]>([]);
const segment = new Segment();
useDefault(segment);
// 新增：需要合并的单字数组（可以根据实际需求调整）
const mergeSingleChars = ['辩', '法', '病', '寒', '强', '的', '地', '得', '了', '着', '过', '在', '于', '和', '与', '或', '而', '但', '却', '以', '为', '因', '由', '自', '从', '向', '到', '对', '于', '给', '把', '被', '让', '叫', '使', '将', '把', '被', '让', '叫', '使', '将', '把', '被', '让', '叫', '使', '将', '把', '被', '让', '叫', '使', '将'];

// 修改onLoad函数
onLoad((query: any) => {
	planId.value = query.planId || "";
	loadSentences();
});


// 新增函数 - 合并单字到上一个词
const mergeSingleCharacters = (words: string[]): string[] => {
	const mergedWords: string[] = [];

	for (let i = 0; i < words.length; i++) {
		const currentWord = words[i];

		// 如果是单字且在合并列表中，且不是第一个词
		if (currentWord.length === 1 && mergeSingleChars.includes(currentWord) && mergedWords.length > 0) {
			// 合并到上一个词
			const lastIndex = mergedWords.length - 1;
			mergedWords[lastIndex] = mergedWords[lastIndex] + currentWord;
		} else {
			// 直接添加到结果数组
			mergedWords.push(currentWord);
		}
	}

	return mergedWords;
};
// 新增函数 - 加载句子
const loadSentences = () => {
	const plans = uni.getStorageSync("plans") || [];
	const articles = uni.getStorageSync("articles") || []; // 获取文章数据
	const plan = plans.find((p: any) => p.id === planId.value);

	if (plan && plan.items && plan.items.length > 0) {
		// 清空之前的句子
		sentences.value = [];

		// 处理每个计划项
		plan.items.forEach((item: any) => {
			let content = "";

			// 根据不同类型获取内容
			if (item.type === 'article' && item.articleId) {
				// 如果是文章类型，根据articleId查找文章内容
				const article = articles.find((a: any) => a.id === item.articleId);
				if (article) {
					content = article.content;
				}
			} else if (item.type === 'paragraph') {
				// 如果是段落类型，直接使用段落内容
				content = item.content;
			} else {
				// 兼容旧数据结构
				content = item.content;
			}

			// 按句号分割内容为多个句子
			const sentenceArray = content.split(/[。！？\n]/)
				.filter((s: string) => s.trim().length > 0)
				.map((sentence: string) => {
					// 对每个句子进行中文分词
					const words = segment.doSegment(sentence.trim(), { simple: true });

					// 过滤掉空字符串和纯标点符号
					const filteredWords = words.filter((word: string) => word.trim().length > 0 && !/^[\s\p{P}]+$/u.test(word));

					// 新增：合并符合条件的单字到上一个词
					return mergeSingleCharacters(filteredWords);
				});

			sentences.value = sentences.value.concat(sentenceArray);
		});

		// 初始化第一个句子
		if (sentences.value.length > 0) {
			currentSentenceIndex.value = 0;
			startRecitation();
		}
	}
};


// 修改startRecitation函数
const startRecitation = () => {
	if (sentences.value.length === 0 || currentSentenceIndex.value >= sentences.value.length) return;

	words.value = [...sentences.value[currentSentenceIndex.value]];
	console.log(words.value)

	// 保存当前句子的正确顺序
	currentSentenceWords.value = [...words.value];

	// 根据难度设置隐藏比例
	let hideRatio = 0;
	if (difficulty.value === 'easy') hideRatio = 0;
	else if (difficulty.value === 'medium') hideRatio = 0.33;
	else if (difficulty.value === 'hard') hideRatio = 0.66;

	const hideCount = Math.floor(words.value.length * hideRatio);
	hiddenIndices.value = [];
	const indices = Array.from({ length: words.value.length }, (_, i) => i);
	for (let i = 0; i < hideCount; i++) {
		const randomIndex = Math.floor(Math.random() * indices.length);
		hiddenIndices.value.push(indices[randomIndex]);
		indices.splice(randomIndex, 1);
	}

	shuffledWords.value = shuffleArray(words.value.filter((_, index) => !hiddenIndices.value.includes(index)));
	userOrder.value = [];
	startTime.value = Date.now();
	showPinyinInput.value = false;

	// 新增 - 重置状态
	isCompleted.value = false;
	startTime.value = Date.now();
	errorIndices.value = []; // 重置错误索引
};

// 修改checkPinyin函数
const checkPinyin = () => {
	if (!currentWord.value) return;

	// 使用 pinyin-pro 获取拼音首字母
	const correctPinyin = pinyin(currentWord.value, {
		pattern: 'first',
		toneType: 'none'
	}).replace(/\s+/g, '');

	if (pinyinInput.value.toLowerCase() === correctPinyin.toLowerCase()) {
		// 拼音正确，显示单词
		const index = hiddenIndices.value.indexOf(currentWordIndex.value);
		if (index > -1) {
			hiddenIndices.value.splice(index, 1);
			// 更新可用词语和用户顺序
			shuffledWords.value = shuffleArray(words.value.filter((_, i) => hiddenIndices.value.includes(i)));
		}
		showPinyinInput.value = false;
		pinyinInput.value = "";
	} else {
		uni.showToast({
			title: `拼音错误，正确拼音首字母是: ${correctPinyin}`,
			icon: "none"
		});
	}
};
const shuffleArray = (array: string[]) => {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
};

const setDifficulty = (level: 'easy' | 'medium' | 'hard') => {
	difficulty.value = level;
	startRecitation();
};

// 修改onLoad函数
onLoad((query: any) => {
	planId.value = query.planId || "";
	loadSentences();
});

// 添加词语到用户顺序
const addWord = (word: string) => {
	userOrder.value.push(word);
	// 从可用词语中移除已选择的词
	const index = shuffledWords.value.indexOf(word);
	if (index > -1) {
		shuffledWords.value.splice(index, 1);
	}
};

// 从用户顺序中移除词语
const removeWord = (word: string) => {
	const index = userOrder.value.indexOf(word);
	if (index > -1) {
		userOrder.value.splice(index, 1);
		// 将词重新添加到可用词语中
		shuffledWords.value.push(word);
		// 如果删除的是错误词语，也需要从错误索引中移除
		const errorIndex = errorIndices.value.indexOf(index);
		if (errorIndex > -1) {
			errorIndices.value.splice(errorIndex, 1);
			// 更新后续错误索引
			errorIndices.value = errorIndices.value.map(idx => idx > index ? idx - 1 : idx);
		}
	}
};

// 显示拼音输入框
const showInput = (index: number) => {
	currentWordIndex.value = index;
	currentWord.value = words.value[index];
	showPinyinInput.value = true;
	pinyinInput.value = "";
};

// 跳过当前词语
const skipWord = () => {
	if (currentWordIndex.value >= 0) {
		// 直接显示该词语
		const index = hiddenIndices.value.indexOf(currentWordIndex.value);
		if (index > -1) {
			hiddenIndices.value.splice(index, 1);
		}
		showPinyinInput.value = false;
		pinyinInput.value = "";
		currentWordIndex.value = -1;
		currentWord.value = "";
	}
};

// 修改checkAnswer函数
const checkAnswer = () => {
	const correct = userOrder.value.join(" ") === currentSentenceWords.value.join(" ");
	const time = Date.now() - startTime.value;

	// 重置错误索引
	errorIndices.value = [];

	if (correct) {
		isCompleted.value = true;
		// 答案正确时，显示完整句子
		displayWords.value = [...currentSentenceWords.value];

		const record = {
			planId: planId.value,
			sentenceIndex: currentSentenceIndex.value,
			correct,
			time,
			date: new Date().toISOString(),
		};
		const records = uni.getStorageSync("recitationRecords") || [];
		records.push(record);
		uni.setStorageSync("recitationRecords", records);

		// 延迟自动进入下一句
		if (currentSentenceIndex.value < sentences.value.length - 1) {
			nextSentence();
		} else {
			// 如果是最后一题，显示完成信息
			uni.showToast({
				title: "已完成所有题目！",
				icon: "success"
			});
		}
	} else {
		// 答案错误时，标记错误的词语
		const minLength = Math.min(userOrder.value.length, currentSentenceWords.value.length);

		// 检查每个位置的词语是否正确
		for (let i = 0; i < minLength; i++) {
			if (userOrder.value[i] !== currentSentenceWords.value[i]) {
				errorIndices.value.push(i);
			}
		}

		// 如果用户排列的词语数量多于正确答案，多余的部分也标记为错误
		for (let i = minLength; i < userOrder.value.length; i++) {
			errorIndices.value.push(i);
		}

		// 如果用户排列的词语数量少于正确答案，不额外标记（因为缺少的无法显示）

		uni.showToast({
			title: "答案不正确，请查看红色标记的词语",
			icon: "none"
		});
		return;
	}
};
const nextSentence = () => {
	if (currentSentenceIndex.value < sentences.value.length - 1) {
		currentSentenceIndex.value++;
		startRecitation();
	} else {
		uni.showToast({ title: "已完成所有题目！", icon: "success" });
	}
};

const prevSentence = () => {
	if (currentSentenceIndex.value > 0) {
		currentSentenceIndex.value--;
		startRecitation();
	} else {
		uni.showToast({ title: "已经是第一句了", icon: "none" });
	}
};
</script>

<style>
.recitation-container {
	padding: 20rpx 30rpx;
	background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
	min-height: 100vh;
}

.header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 30rpx;
	padding: 30rpx;
	border-radius: 20rpx;
	background: linear-gradient(90deg, #4b6cb7 0%, #182848 100%);
	box-shadow: 0 6rpx 12rpx rgba(0, 0, 0, 0.15);
}

.header-actions {
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.settings-btn {
	background: rgba(255, 255, 255, 0.2);
	color: white;
	border: none;
	padding: 12rpx 25rpx;
	border-radius: 30rpx;
	font-size: 28rpx;
	font-weight: bold;
	backdrop-filter: blur(10rpx);
}

.settings-panel {
	margin-bottom: 30rpx;
	padding: 30rpx;
	background: white;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.08);
}

.title {
	font-size: 40rpx;
	font-weight: bold;
	color: white;
	text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.3);
}

.sentence-progress {
	background-color: rgba(255, 255, 255, 0.2);
	color: white;
	padding: 12rpx 25rpx;
	border-radius: 30rpx;
	font-size: 30rpx;
	font-weight: bold;
	backdrop-filter: blur(10rpx);
}

.section-title {
	font-size: 32rpx;
	font-weight: 600;
	color: #2c3e50;
	margin-bottom: 20rpx;
	display: block;
	position: relative;
	padding-left: 20rpx;
}

.section-title::before {
	content: '';
	position: absolute;
	left: 0;
	top: 50%;
	transform: translateY(-50%);
	width: 8rpx;
	height: 30rpx;
	background: linear-gradient(to bottom, #3498db, #2c3e50);
	border-radius: 4rpx;
}

.difficulty-selector {
	margin-bottom: 40rpx;
	padding: 30rpx;
	background: white;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.08);
}

.difficulty-buttons {
	display: flex;
	gap: 25rpx;
}

.difficulty-btn {
	flex: 1;
	padding: 20rpx 0;
	border: 2px solid #e0e0e0;
	border-radius: 15rpx;
	background: white;
	color: #666;
	font-size: 30rpx;
	font-weight: 500;
	transition: all 0.3s ease;
	box-shadow: 0 2rpx 5rpx rgba(0, 0, 0, 0.05);
}

.difficulty-btn.active {
	background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
	color: white;
	border-color: #2575fc;
	transform: translateY(-4rpx);
	box-shadow: 0 6rpx 12rpx rgba(37, 117, 252, 0.3);
}

.difficulty-btn:not(.active):hover {
	transform: translateY(-2rpx);
	box-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.1);
	border-color: #3498db;
}

.paragraph-section {
	margin-bottom: 40rpx;
}

.paragraph {
	display: flex;
	flex-wrap: wrap;
	padding: 30rpx;
	background: white;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.08);
	min-height: 140rpx;
}

.paragraph text {
	margin: 10rpx;
	padding: 15rpx 20rpx;
	border-radius: 12rpx;
	font-size: 32rpx;
	font-weight: 500;
	transition: all 0.2s ease;
}

.paragraph text.hidden {
	background: #f0f5ff;
	color: transparent;
	cursor: pointer;
	border: 2px dashed #3498db;
	box-shadow: inset 0 0 8rpx rgba(52, 152, 219, 0.2);
}

.pinyin-input-section {
	background: white;
	padding: 35rpx;
	border-radius: 20rpx;
	box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.1);
	margin-bottom: 40rpx;
	border-left: 8rpx solid #3498db;
}

.prompt {
	font-size: 30rpx;
	color: #2c3e50;
	font-weight: 500;
	margin-bottom: 25rpx;
	display: block;
}

.pinyin-input {
	border: 2px solid #e0e0e0;
	border-radius: 15rpx;
	padding: 20rpx;
	margin-bottom: 25rpx;
	width: 100%;
	font-size: 30rpx;
	background: #f8f9fa;
	transition: border-color 0.3s;
}

.pinyin-input:focus {
	border-color: #3498db;
	outline: none;
	box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.input-actions {
	display: flex;
	gap: 25rpx;
}

.action-btn {
	flex: 1;
	padding: 20rpx 0;
	border-radius: 15rpx;
	font-size: 30rpx;
	font-weight: 500;
	transition: all 0.3s ease;
}

.action-btn.primary {
	background: linear-gradient(135deg, #3498db 0%, #2c3e50 100%);
	color: white;
	border: none;
	box-shadow: 0 4rpx 10rpx rgba(52, 152, 219, 0.3);
}

.action-btn:not(.primary) {
	background: #f8f9fa;
	color: #666;
	border: 2px solid #e0e0e0;
}

.word-sorting-section {
	margin-bottom: 40rpx;
	padding: 30rpx;
	background: white;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.08);
}

.hint-section {
	margin: 30rpx 0;
	text-align: center;
}

.hint-btn {
	background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
	color: white;
	border: none;
	padding: 20rpx 35rpx;
	border-radius: 15rpx;
	font-size: 30rpx;
	font-weight: 500;
	margin-bottom: 20rpx;
	box-shadow: 0 4rpx 10rpx rgba(255, 152, 0, 0.3);
	transition: all 0.3s ease;
}

.hint-btn:hover {
	transform: translateY(-3rpx);
	box-shadow: 0 6rpx 12rpx rgba(255, 152, 0, 0.4);
}

.hint-text {
	display: block;
	color: #e74c3c;
	font-weight: 600;
	font-size: 30rpx;
	padding: 15rpx;
	background: #fff8e1;
	border-radius: 12rpx;
	border-left: 6rpx solid #f39c12;
}

.available-words,
.user-order {
	margin-bottom: 30rpx;
}

.word-list {
	display: flex;
	flex-wrap: wrap;
	gap: 20rpx;
	margin-top: 15rpx;
}

.word-item {
	padding: 15rpx 25rpx;
	background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
	border-radius: 12rpx;
	font-size: 30rpx;
	font-weight: 500;
	color: #1976d2;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.08);
	border: 1px solid #bbdefb;
}

.word-item.user-word {
	background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
	color: white;
	box-shadow: 0 4rpx 8rpx rgba(76, 175, 80, 0.3);
	border: 1px solid #4caf50;
	transform: scale(1.05);
}

/* 新增：错误词语样式 */
.error-word {
	background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%) !important;
	color: white !important;
	box-shadow: 0 4rpx 8rpx rgba(244, 67, 54, 0.3) !important;
	border: 1px solid #f44336 !important;
	animation: shake 0.5s ease-in-out;
}

@keyframes shake {

	0%,
	100% {
		transform: translateX(0) scale(1.05);
	}

	25% {
		transform: translateX(-5rpx) scale(1.05);
	}

	75% {
		transform: translateX(5rpx) scale(1.05);
	}
}

.word-item:hover {
	transform: translateY(-4rpx) scale(1.03);
	box-shadow: 0 6rpx 12rpx rgba(0, 0, 0, 0.15);
}

.check-answer-btn {
	width: 100%;
	padding: 25rpx 0;
	background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
	color: white;
	border: none;
	border-radius: 15rpx;
	font-size: 32rpx;
	font-weight: 600;
	margin-top: 25rpx;
	box-shadow: 0 6rpx 15rpx rgba(76, 175, 80, 0.4);
	transition: all 0.3s ease;
}

.check-answer-btn:hover {
	transform: translateY(-3rpx);
	box-shadow: 0 8rpx 18rpx rgba(76, 175, 80, 0.5);
}

.navigation-controls {
	display: flex;
	gap: 25rpx;
	margin-bottom: 40rpx;
}

.nav-btn {
	flex: 1;
	padding: 25rpx 0;
	border: 2px solid #e0e0e0;
	border-radius: 15rpx;
	background: white;
	font-size: 30rpx;
	font-weight: 500;
	transition: all 0.3s ease;
	box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.08);
}

.nav-btn:not(:disabled):hover {
	transform: translateY(-3rpx);
	box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.15);
}

.nav-btn.skip-btn {
	background: linear-gradient(135deg, #ff9800 0%, #e65100 100%);
	color: white;
	border-color: #ff9800;
	box-shadow: 0 4rpx 10rpx rgba(255, 152, 0, 0.3);
}

.nav-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
	transform: none;
	box-shadow: none;
}

.completion-message {
	text-align: center;
	color: white;
	font-weight: bold;
	font-size: 36rpx;
	margin: 40rpx 0;
	padding: 40rpx;
	background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
	border-radius: 20rpx;
	box-shadow: 0 8rpx 20rpx rgba(76, 175, 80, 0.4);
	animation: pulse 2s infinite;
}

@keyframes pulse {
	0% {
		transform: scale(1);
	}

	50% {
		transform: scale(1.02);
	}

	100% {
		transform: scale(1);
	}
}
</style>
