
<template>
	<view>
		<text>背诵页面</text>
		<view class="difficulty-selector">
			<text>选择难度：</text>
			<button @click="setDifficulty('easy')" :class="{ active: difficulty === 'easy' }">简单</button>
			<button @click="setDifficulty('medium')" :class="{ active: difficulty === 'medium' }">中等</button>
			<button @click="setDifficulty('hard')" :class="{ active: difficulty === 'hard' }">困难</button>
		</view>
		<view>
			<text>段落：</text>
			<view class="paragraph">
				<text v-for="(word, index) in displayWords" :key="index" :class="{ hidden: hiddenIndices.includes(index) }"
					@click="hiddenIndices.includes(index) ? showInput(index) : null">
					{{ word }}
				</text>
			</view>
		</view>
		<view v-if="showPinyinInput" class="pinyin-input">
			<text>请输入 "{{ currentWord }}" 的拼音首字母：</text>
			<input v-model="pinyinInput" @confirm="checkPinyin" placeholder="例如: zh, ch, sh" />
			<button @click="checkPinyin">确认</button>
			<button @click="skipWord">跳过</button>
		</view>
		<view v-if="!showPinyinInput">
			<text>可用词语:</text>
			<text v-for="word in shuffledWords" :key="word" @click="addWord(word)">{{ word }} </text>
		</view>
		<view v-if="!showPinyinInput">
			<text>你的顺序:</text>
			<text v-for="word in userOrder" :key="word" @click="removeWord(word)">{{ word }} </text>
		</view>
		<view v-if="!showPinyinInput" @click="checkAnswer">
			<text>检查答案</text>
		</view>

		<!-- 新增导航控制 -->
		<view class="navigation-controls">
			<button @click="prevSentence" :disabled="currentSentenceIndex === 0">上一句</button>
			<text>{{ currentSentenceIndex + 1 }}/{{ sentences.length }}</text>
			<button @click="nextSentence" :disabled="currentSentenceIndex === sentences.length - 1">下一句</button>
			<button @click="skipWord">跳过</button>
		</view>

		<!-- 修改完成状态显示 -->
		<view v-if="isCompleted" class="completion-message">
			<text>恭喜完成本句！</text>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { pinyin } from 'pinyin-pro'; // 新增导入

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

// 删除原有的 pinyinMap 定义
// 修改 checkPinyin 函数
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

// 新增变量
const currentSentenceIndex = ref(0);
const sentences = ref<string[][]>([]); // 存储分割后的句子数组
const isCompleted = ref(false);

// 修改onLoad函数
onLoad((query: any) => {
	planId.value = query.planId || "";
	loadSentences();
});

// 新增函数 - 加载句子
const loadSentences = () => {
	const plans = uni.getStorageSync("plans") || [];
	const plan = plans.find((p: any) => p.id === planId.value);
	if (plan && plan.items.length > 0) {
		// 按句号分割内容为多个句子
		const content = plan.items[0].content;
		sentences.value = content.split(/[。！？]/).filter(s => s.trim().length > 0)
			.map(sentence => sentence.trim().split(/\s+/));
		console.log(content);
		startRecitation();
	}
};

// 修改startRecitation函数
const startRecitation = () => {
	if (sentences.value.length === 0) return;

	words.value = [...sentences.value[currentSentenceIndex.value]];
	displayWords.value = [...words.value];

	// 根据难度设置隐藏比例
	let hideRatio = 0;
	if (difficulty.value === 'easy') hideRatio = 0.2;
	else if (difficulty.value === 'medium') hideRatio = 0.4;
	else if (difficulty.value === 'hard') hideRatio = 0.6;

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
	// ... 保留原有的难度设置逻辑 ...

	// 新增 - 重置状态
	isCompleted.value = false;
	startTime.value = Date.now();
};

// 新增函数 - 下一句
const nextSentence = () => {
	if (currentSentenceIndex.value < sentences.value.length - 1) {
		currentSentenceIndex.value++;
		startRecitation();
	} else {
		uni.showToast({ title: "已经是最后一句了", icon: "none" });
	}
};

// 新增函数 - 上一句
const prevSentence = () => {
	if (currentSentenceIndex.value > 0) {
		currentSentenceIndex.value--;
		startRecitation();
	} else {
		uni.showToast({ title: "已经是第一句了", icon: "none" });
	}
};

// 修改checkAnswer函数
const checkAnswer = () => {
	const correct = userOrder.value.join(" ") === words.value.join(" ");
	const time = Date.now() - startTime.value;

	if (correct) {
		isCompleted.value = true;
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
	}

	uni.showModal({
		title: correct ? "正确" : "错误",
		content: `用时: ${time}ms`,
		success: () => {
			if (correct) nextSentence();
		}
	});
};
</script>

<style>
.difficulty-selector {
	display: flex;
	justify-content: center;
	align-items: center;
	margin: 20rpx 0;
}

.difficulty-selector button {
	margin: 0 10rpx;
	padding: 10rpx 20rpx;
	border: 1px solid #ccc;
	border-radius: 5rpx;
	background: white;
}

.difficulty-selector button.active {
	background: #007aff;
	color: white;
}

.paragraph {
	display: flex;
	flex-wrap: wrap;
	margin: 20rpx 0;
	padding: 20rpx;
	border: 1px solid #eee;
	border-radius: 5rpx;
}

.paragraph text {
	margin: 5rpx;
	padding: 5rpx;
	border-radius: 3rpx;
}

.paragraph text.hidden {
	background: #f0f0f0;
	color: #999;
	cursor: pointer;
	border: 1px dashed #ccc;
}

.pinyin-input {
	margin: 20rpx 0;
	padding: 20rpx;
	border: 1px solid #eee;
	border-radius: 5rpx;
	background: #f9f9f9;
}

.pinyin-input input {
	border: 1px solid #ccc;
	border-radius: 3rpx;
	padding: 10rpx;
	margin: 10rpx 0;
	width: 100%;
}

/* 新增样式 */
.navigation-controls {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin: 20rpx 0;
	padding: 10rpx;
}

.navigation-controls button {
	padding: 10rpx 20rpx;
	border: 1px solid #ccc;
	border-radius: 5rpx;
	background: white;
}

.navigation-controls button:disabled {
	opacity: 0.5;
}

.completion-message {
	text-align: center;
	color: green;
	font-weight: bold;
	margin: 20rpx 0;
}
</style>

