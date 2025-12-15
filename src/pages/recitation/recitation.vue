<template>
	<view class="recitation-container">
		<!-- 头部信息 -->
		<view class="header">
			<text class="title">背诵练习</text>
			<view class="header-actions">
				<view class="sentence-progress">
					<text class="sentence-err-num">{{ errorCount }}</text><text>/{{ currentSentenceIndex + 1 }}/{{
						sentences.length }}</text>
				</view>
				<!-- 修改：显示总游戏时长 -->
				<view class="time-display">
					<text>{{ formatTime(totalGameTime) }}</text>
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
			<!-- 新增：重置进度按钮 -->
			<view class="reset-section">
				<text class="section-title">学习进度：</text>
				<button @click="resetProgress" class="reset-btn">重新开始</button>
			</view>
		</view>

		<!-- 词语排序区域 -->
		<view v-if="!showPinyinInput" class="word-sorting-section">
			<view class="available-words">
				<text class="section-title">可用词语:</text>
				<view class="word-list">
					<text v-for="(word, i) in shuffledWords" :key="i"
						@touchstart="onAvailableWordDragStart(word, $event)"
						@touchmove="onAvailableWordDragMove($event)" @touchend="onAvailableWordDragEnd" :class="['word-item', 'draggable-word', {
							'dragging': draggingWord === word
						}]" :style="{ pointerEvents: isDragging ? 'none' : 'auto' }">
						{{ word }}
					</text>
				</view>
			</view>

			<view class="user-order">
				<text class="section-title">你的顺序:</text>
				<view class="word-list">
					<view v-for="(correctWord, index) in currentSentenceWords" :key="index"
						class="placeholder-container" @touchmove="onPlaceholderDragMove($event, index)"
						@touchend="onPlaceholderDragEnd(index)" :class="{ 'drag-over': dragOverIndex === index }">

						<!-- 1. 如果该位置有用户放置的词语 -->
						<text v-if="getUserWordAtPosition(index)" @touchstart="onDragStart(index, $event)"
							@touchmove="onDragMove($event)" @touchend="onDragEnd" :class="['word-item', 'user-word', 'draggable-word', {
								'error-word': errorIndices.includes(index),
								'dragging': draggingIndex === index,
								'drag-over': dragOverIndex === index
							}]" :style="{ pointerEvents: isDragging ? 'none' : 'auto' }">
							{{ getUserWordAtPosition(index) }}
						</text>

						<!-- 2. 如果该位置是拼音输入框 -->
						<view v-else-if="hiddenIndices.includes(index)" class="pinyin-input-wrapper" :class="{
							'error-word': errorIndices.includes(index),
						}">
							<input v-model="userPinyinInputs[index]"
								:placeholder="'' + currentSentenceWords[index].length" class="direct-pinyin-input"
								@input="onPinyinInput(index)" />
						</view>

						<!-- 3. 如果该位置是空占位符 -->
						<text v-else class="word-item sort-placeholder">
							____
						</text>
					</view>
				</view>
			</view>
			<button @click="checkAnswer" class="check-answer-btn">确 认</button>
		</view>

		<!-- 新增：进度提示 -->
		<view v-if="showProgressHint" class="progress-hint">
			<text class="hint-text">{{ progressHintText }}</text>
		</view>

		<!-- 导航控制 -->
		<view class="navigation-controls">
			<button @click="prevSentence" :disabled="currentSentenceIndex === 0" class="nav-btn">上一句</button>
			<button @click="nextSentence" :disabled="currentSentenceIndex === sentences.length - 1"
				class="nav-btn">下一句</button>
			<button @click="showAnswer" class="nav-btn skip-btn">查看答案</button>
		</view>
	</view>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { pinyin } from 'pinyin-pro';
// @ts-ignore
import { Segment, useDefault } from 'segmentit';

const planId = ref("");
const words = ref<string[]>([]);
const shuffledWords = ref<string[]>([]);
const startTime = ref(0);
const difficulty = ref<'easy' | 'medium' | 'hard'>('easy');
const hiddenIndices = ref<number[]>([]);
const displayWords = ref<string[]>([]);
const showPinyinInput = ref(false);
const currentWordIndex = ref(-1);
const currentWord = ref("");
const pinyinInput = ref("");
const showSettings = ref(false);
const userOrder = ref<{ position: number, word: string }[]>([]); // 改为对象数组，记录位置信息
const emptyIndices = ref<number[]>([]); // 记录空位置

// 新增：用于存储当前句子的正确顺序
const currentSentenceWords = ref<string[]>([]);

// 新增变量
const errorCount = ref(0);
const currentSentenceIndex = ref(0);
const sentences = ref<string[][]>([]); // 存储分割后的句子数组
const isCompleted = ref(false);

// 新增：用于存储错误词语的索引
const errorIndices = ref<number[]>([]);
const segment = new Segment();
useDefault(segment);

// 新增：学习进度存储键名
const PROGRESS_KEY = 'learningProgress';

// 新增：用于存储用户输入的拼音
const userPinyinInputs = ref<{ [key: number]: string }>({});

// 新增：显示答案标记
const showAnswerFlag = ref(false);

// 新增：拖动相关变量
const draggingIndex = ref(-1);
const dragOverIndex = ref(-1);
const dragStartY = ref(0);
const dragStartX = ref(0); // 新增：记录拖动开始的X坐标
const isDragging = ref(false);
const draggingWord = ref(""); // 新增：用于存储正在拖动的可用词语
const isDraggingFromAvailable = ref(false); // 新增：标记是否从可用区域拖动

// 新增：答题时间显示
const elapsedTime = ref(0);
// 修改：总游戏时长（整个计划的学习时间）
const totalGameTime = ref(0);
const timerInterval = ref<any>(null);
const showProgressHint = ref(false);
const progressHintText = ref("");
// 新增：计划开始时间
const planStartTime = ref(0);

// 修改：格式化时间显示
const formatTime = (milliseconds: number): string => {
	const seconds = Math.floor(milliseconds / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// 修改：启动计时器（记录整个计划的总时长）
const startTimer = () => {
	if (timerInterval.value) {
		clearInterval(timerInterval.value);
	}

	// 如果是第一次启动，记录计划开始时间
	if (planStartTime.value === 0) {
		planStartTime.value = Date.now();
	}

	timerInterval.value = setInterval(() => {
		totalGameTime.value = Date.now() - planStartTime.value;
	}, 1000);
};
// 新增：停止计时器
const stopTimer = () => {
	if (timerInterval.value) {
		clearInterval(timerInterval.value);
		timerInterval.value = null;
	}
};

// 新增：显示进度提示
const showProgressHintMessage = (message: string) => {
	showProgressHint.value = true;
	progressHintText.value = message;
	setTimeout(() => {
		showProgressHint.value = false;
	}, 1000);
};
// 新增函数 - 在句子加载时启动计时器
const onSentenceLoad = () => {
	startTimer();
};

// 新增函数 - 在指定位置添加词语
const addWordAtPosition = (word: string, position: number) => {
	// 检查目标位置是否有效
	if (position < 0 || position >= currentSentenceWords.value.length) {
		return;
	}

	// 检查目标位置是否是拼音输入区，如果是则不允许放置
	if (hiddenIndices.value.includes(position)) {
		return;
	}

	// 检查目标位置是否已经有词语
	const existingItem = userOrder.value.find(item => item.position === position);
	if (existingItem) {
		// 如果目标位置已经有词语，则寻找下一个可用位置
		let availablePosition = -1;
		for (let i = 0; i < currentSentenceWords.value.length; i++) {
			// 跳过拼音输入框位置
			if (hiddenIndices.value.includes(i)) continue;
			// 如果位置为空，则找到可用位置
			const itemAtPos = userOrder.value.find(item => item.position === i);
			if (!itemAtPos) {
				availablePosition = i;
				break;
			}
		}

		if (availablePosition === -1) {
			// 没有可用位置
			uni.showToast({
				title: '没有可用位置',
				icon: 'none'
			});
			return;
		}

		position = availablePosition;
	}

	// 检查词语是否已存在
	const existingWordIndex = userOrder.value.findIndex(item => item.word === word);
	if (existingWordIndex > -1) {
		// 如果词语已存在，先移除
		userOrder.value.splice(existingWordIndex, 1);
	} else {
		// 从可用词语中移除已选择的词
		const index = shuffledWords.value.indexOf(word);
		if (index > -1) {
			shuffledWords.value.splice(index, 1);
		}
	}

	// 在指定位置添加词语
	userOrder.value.push({ position, word });

	// 更新错误索引
	if (errorIndices.value.length > 0) {
		const newErrorIndices = [...errorIndices.value];
		newErrorIndices.forEach((errorIndex, i) => {
			if (errorIndex >= position) {
				newErrorIndices[i] = errorIndex + 1;
			}
		});
		errorIndices.value = newErrorIndices;
	}
};

// 新增变量 - 拖动距离阈值
const DRAG_THRESHOLD = 30;
const touchStartTime = ref(0);

// 修改现有拖动函数 - 排序区域拖动开始
const onDragStart = (index: number, event: TouchEvent) => {
	event.preventDefault(); // 防止页面滚动导致的跳动
	isDragging.value = false; // 初始状态为false，等待距离判定
	isDraggingFromAvailable.value = false;
	draggingIndex.value = index;
	dragStartY.value = event.touches[0].clientY;
	dragStartX.value = event.touches[0].clientX; // 新增：记录X坐标
	touchStartTime.value = Date.now(); // 记录触摸开始时间
};

// 新增函数 - 可用词语拖动开始
const onAvailableWordDragStart = (word: string, event: TouchEvent) => {
	event.preventDefault(); // 防止页面滚动导致的跳动
	isDragging.value = false; // 初始状态为false，等待距离判定
	isDraggingFromAvailable.value = true;
	draggingWord.value = word;
	dragStartY.value = event.touches[0].clientY;
	dragStartX.value = event.touches[0].clientX; // 新增：记录X坐标
	touchStartTime.value = Date.now(); // 记录触摸开始时间
};

// 修改现有拖动函数 - 排序区域拖动移动（排序区内互相拖动）
const onDragMove = (event: TouchEvent) => {
	event.preventDefault(); // 防止页面滚动导致的跳动

	const currentY = event.touches[0].clientY + 30;
	const currentX = event.touches[0].clientX;
	const deltaY = currentY - dragStartY.value;
	const deltaX = currentX - dragStartX.value; // 新增：计算X轴移动距离

	// 只有当移动距离超过阈值时才激活拖动（同时判断x轴和y轴）
	const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	if (totalDistance > DRAG_THRESHOLD && !isDragging.value) {
		isDragging.value = true;
		isDraggingFromAvailable.value = false;
	}

	const elements = document.querySelectorAll('.placeholder-container');
	if (!isDragging.value || isDraggingFromAvailable.value) return;

	// 计算当前拖动的元素在列表中的位置
	let newDragOverIndex = -1;
	let minDistance = Infinity;


	elements.forEach((el, i) => {
		// 检查目标位置是否是拼音输入框，如果是则不允许放置
		if (hiddenIndices.value.includes(i)) {
			return;
		}

		// 关键修复：排除拖动元素自身的位置，防止自身位置被检测为可停靠区
		if (i === draggingIndex.value) {
			return;
		}


		const rect = el.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		// 计算触摸点与元素中心的距离
		const distanceX = Math.abs(currentX - centerX);
		const distanceY = Math.abs(currentY - centerY);
		const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

		// 改进检测逻辑：使用更严格的检测条件
		// 只有当触摸点真正进入元素边界内，并且距离足够近时才检测
		if (currentX >= rect.left && currentX <= rect.right &&
			currentY >= rect.top && currentY <= rect.bottom &&
			distance < 50) { // 添加距离限制
			// 如果距离更小，更新目标位置
			if (distance < minDistance) {
				minDistance = distance;
				newDragOverIndex = i;
			}
		}
	});

	// 简化条件判断：只要找到有效位置就设置拖放目标
	if (newDragOverIndex !== -1) {
		dragOverIndex.value = newDragOverIndex;
	} else {
		dragOverIndex.value = -1;
	}
};


// 新增函数 - 可用词语拖动移动（从可用词拖动到排序区）
const onAvailableWordDragMove = (event: TouchEvent) => {
	event.preventDefault(); // 防止页面滚动导致的跳动

	const currentY = event.touches[0].clientY + 30;
	const currentX = event.touches[0].clientX;
	const deltaY = currentY - dragStartY.value;
	const deltaX = currentX - dragStartX.value; // 新增：计算X轴移动距离

	// 只有当移动距离超过阈值时才激活拖动（同时判断x轴和y轴）
	const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	if (totalDistance > DRAG_THRESHOLD && !isDragging.value) {
		isDragging.value = true;
		isDraggingFromAvailable.value = true;
	}

	if (!isDragging.value || !isDraggingFromAvailable.value) return;

	// 如果移动距离超过阈值，开始检测拖放目标
	// 计算当前拖动的元素在用户排序区域的位置
	const elements = document.querySelectorAll('.placeholder-container');
	let newDragOverIndex = -1;
	let minDistance = Infinity; // 新增：记录最小距离

	elements.forEach((el, i) => {
		// 检查目标位置是否是拼音输入区，如果是则不允许放置
		if (hiddenIndices.value.includes(i)) {
			return;
		}

		const rect = el.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		// 新增：计算触摸点与元素中心的距离
		const distanceX = Math.abs(currentX - centerX);
		const distanceY = Math.abs(currentY - centerY);
		const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

		// 从可用词拖动：使用较大的检测范围，确保良好的用户体验
		// 扩展检测范围到元素周围30像素
		if (currentX >= rect.left - 30 && currentX <= rect.right + 30 &&
			currentY >= rect.top - 30 && currentY <= rect.bottom + 30) {
			// 如果距离更小，更新目标位置
			if (distance < minDistance) {
				minDistance = distance;
				newDragOverIndex = i;
			}
		}
	});

	if (newDragOverIndex !== -1) {
		dragOverIndex.value = newDragOverIndex;
	} else {
		// 如果没有找到合适的位置，清除拖放目标
		dragOverIndex.value = -1;
	}
};

// 新增函数 - 占位符容器拖动移动
const onPlaceholderDragMove = (event: TouchEvent, index: number) => {
	event.preventDefault(); // 防止页面滚动导致的跳动

	const currentY = event.touches[0].clientY;
	const currentX = event.touches[0].clientX;
	const deltaY = currentY - dragStartY.value;
	const deltaX = currentX - dragStartX.value; // 新增：计算X轴移动距离

	// 只有当移动距离超过阈值时才激活拖动（同时判断x轴和y轴）
	const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	if (totalDistance > DRAG_THRESHOLD && !isDragging.value) {
		isDragging.value = true;
	}

	if (!isDragging.value || !isDraggingFromAvailable.value) return;
	// 检查目标位置是否是拼音输入区，如果是则不允许放置
	if (hiddenIndices.value.includes(index)) {
		return;
	}

	// 改进：检查触摸点是否在占位符区域内
	const element = document.querySelector(`.placeholder-container:nth-child(${index + 1})`);
	if (element) {
		const rect = element.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		// 计算触摸点与元素中心的距离
		const distanceX = Math.abs(currentX - centerX);
		const distanceY = Math.abs(currentY - centerY);
		const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

		// 如果触摸点在元素附近，设置拖放目标
		if (distance < 100) { // 扩大检测范围到100像素
			dragOverIndex.value = index;
		} else {
			dragOverIndex.value = -1;
		}
	}
};

// 新增函数 - 排序区域拖动结束
const onDragEnd = (event?: TouchEvent) => {
	// 如果是点击事件（移动距离小于阈值）
	if (event && !isDragging.value) {
		const currentY = event.changedTouches[0].clientY;
		const currentX = event.changedTouches[0].clientX;
		const deltaY = Math.abs(currentY - dragStartY.value);
		const deltaX = Math.abs(currentX - dragStartX.value); // 新增：计算X轴移动距离
		const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		if (totalDistance < DRAG_THRESHOLD) {
			// 触发点击移除词语
			const word = userOrder.value.find(e => e.position === draggingIndex.value)
			if (word) {
				removeWord(word.word);
			}
			return;
		}
	}

	if (!isDragging.value || isDraggingFromAvailable.value) return;

	if (dragOverIndex.value !== -1 && dragOverIndex.value !== draggingIndex.value) {
		// 执行词语位置插入（插入并整体后移）
		moveWord(draggingIndex.value, dragOverIndex.value);
	}

	// 重置拖动状态
	isDragging.value = false;
	isDraggingFromAvailable.value = false;
	draggingIndex.value = -1;
	dragOverIndex.value = -1;
	dragStartY.value = 0;
	dragStartX.value = 0; // 新增：重置X坐标
};

// 新增函数 - 可用词语拖动结束
const onAvailableWordDragEnd = (event?: TouchEvent) => {
	// 如果是点击事件（移动距离小于阈值）
	if (event && !isDragging.value) {
		const currentY = event.changedTouches[0].clientY;
		const currentX = event.changedTouches[0].clientX;
		const deltaY = Math.abs(currentY - dragStartY.value);
		const deltaX = Math.abs(currentX - dragStartX.value); // 新增：计算X轴移动距离
		const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		if (totalDistance < DRAG_THRESHOLD) {
			// 触发点击添加词语
			if (draggingWord.value) {
				addWord(draggingWord.value);
			}
			return;
		}
	}

	if (!isDragging.value || !isDraggingFromAvailable.value) return;
	if (dragOverIndex.value !== -1) {
		// 检查目标位置是否是拼音输入框，如果是则不允许放置
		if (hiddenIndices.value.includes(dragOverIndex.value)) {
			uni.showToast({
				title: '不能将词语拖动到拼音输入框位置',
				icon: 'none'
			});
			return;
		}

		// 检查目标位置是否已经有词语
		const existingItem = userOrder.value.find(item => item.position === dragOverIndex.value);
		if (existingItem) {
			// 如果目标位置已经有词语，则执行插入并整体后移
			insertWordFromAvailable(draggingWord.value, dragOverIndex.value);
		} else {
			// 如果目标位置为空，则直接添加词语
			addWordAtPosition(draggingWord.value, dragOverIndex.value);
		}
	}

	// 重置拖动状态
	isDragging.value = false;
	isDraggingFromAvailable.value = false;
	draggingWord.value = "";
	dragOverIndex.value = -1;
	dragStartY.value = 0;
	dragStartX.value = 0; // 新增：重置X坐标
};

// 新增函数 - 从可用词区域插入词语并整体后移
const insertWordFromAvailable = (word: string, position: number) => {
	// 检查目标位置是否有效
	if (position < 0 || position >= currentSentenceWords.value.length) {
		return;
	}

	// 检查目标位置是否是拼音输入区，如果是则不允许放置
	if (hiddenIndices.value.includes(position)) {
		return;
	}

	// 从可用词语中移除已选择的词
	const index = shuffledWords.value.indexOf(word);
	if (index > -1) {
		shuffledWords.value.splice(index, 1);
	}

	// 创建新的排序数组
	const newOrder = [...userOrder.value];

	// 将目标位置及之后的词语向后移动一位，跳过拼音占位符
	for (let i = currentSentenceWords.value.length - 1; i >= position; i--) {
		// 跳过拼音占位符位置
		if (hiddenIndices.value.includes(i)) continue;

		const item = newOrder.find(item => item.position === i);
		if (item) {
			// 计算实际移动的目标位置（跳过拼音占位符）
			let newPosition = i + 1;
			// 如果新位置是拼音占位符，继续向后移动
			while (hiddenIndices.value.includes(newPosition) && newPosition < currentSentenceWords.value.length) {
				newPosition++;
			}
			// 只有当新位置有效时才移动
			if (newPosition < currentSentenceWords.value.length) {
				item.position = newPosition;
			}
		}
	}

	// 在目标位置添加新词语
	newOrder.push({ position, word });

	// 按位置排序
	newOrder.sort((a, b) => a.position - b.position);
	userOrder.value = newOrder;

	// 更新错误索引
	if (errorIndices.value.length > 0) {
		const newErrorIndices = [...errorIndices.value];
		newErrorIndices.forEach((errorIndex, i) => {
			if (errorIndex >= position) {
				// 跳过拼音占位符
				if (hiddenIndices.value.includes(errorIndex)) {
					return; // 拼音占位符的错误索引保持不变
				}
				newErrorIndices[i] = errorIndex + 1;
			}
		});
		errorIndices.value = newErrorIndices;
	}
};

// 新增函数 - 占位符容器拖动结束
const onPlaceholderDragEnd = (index: number, event?: TouchEvent) => {
	if (!isDragging.value || !isDraggingFromAvailable.value) return;

	if (dragOverIndex.value !== -1) {
		// 检查目标位置是否是拼音输入框，如果是则不允许放置
		if (hiddenIndices.value.includes(dragOverIndex.value)) {
			uni.showToast({
				title: '不能将词语拖动到拼音输入框位置',
				icon: 'none'
			});
			return;
		}

		// 检查目标位置是否已经有词语
		const existingItem = userOrder.value.find(item => item.position === dragOverIndex.value);
		if (existingItem) {
			// 如果目标位置已经有词语，则执行插入并整体后移
			insertWordFromAvailable(draggingWord.value, dragOverIndex.value);
		} else {
			// 如果目标位置为空，则直接添加词语
			addWordAtPosition(draggingWord.value, dragOverIndex.value);
		}
	}
	// 重置拖动状态
	isDragging.value = false;
	isDraggingFromAvailable.value = false;
	draggingWord.value = "";
	dragOverIndex.value = -1;
	dragStartY.value = 0;
};

// 修改onLoad函数
onLoad((query: any) => {
	planId.value = query.planId || "";
	loadSentences();
});


// 修改函数 - 移动词语位置（插入并整体后移，保护拼音占位符）
const moveWord = (fromIndex: number, toIndex: number) => {
	if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
		return;
	}

	// 获取拖动的词语
	const movedItem = userOrder.value.find(item => item.position === fromIndex);
	if (!movedItem) return;

	// 检查目标位置是否是拼音输入框，如果是则不允许放置
	if (hiddenIndices.value.includes(toIndex)) {
		uni.showToast({
			title: '不能将词语拖动到拼音输入框位置',
			icon: 'none'
		});
		return;
	}

	// 创建新的排序数组
	const newOrder = [...userOrder.value];

	// 从原位置移除词语
	const fromItemIndex = newOrder.findIndex(item => item.position === fromIndex);
	if (fromItemIndex === -1) return;
	newOrder.splice(fromItemIndex, 1);

	// 重新计算所有词语的位置，跳过拼音占位符
	if (fromIndex < toIndex) {
		// 向后拖动：从fromIndex到toIndex-1的词语向前移动一位，跳过拼音占位符
		for (let i = fromIndex + 1; i <= toIndex; i++) {
			// 跳过拼音占位符位置
			if (hiddenIndices.value.includes(i)) continue;

			const item = newOrder.find(item => item.position === i);
			if (item) {
				// 计算实际移动的目标位置（跳过拼音占位符）
				let newPosition = i - 1;
				// 如果新位置是拼音占位符，继续向前移动
				while (hiddenIndices.value.includes(newPosition) && newPosition > fromIndex) {
					newPosition--;
				}
				// 只有当新位置有效时才移动（不能小于0）
				if (newPosition >= 0 && newPosition < currentSentenceWords.value.length) {
					item.position = newPosition;
				} else {
					// 如果新位置无效，保持原位置不变
					item.position = i;
				}
			}
		}
		// 将拖动的词语插入到目标位置
		movedItem.position = toIndex;
	} else {
		// 向前拖动：从toIndex到fromIndex-1的词语向后移动一位，跳过拼音占位符
		for (let i = fromIndex - 1; i >= toIndex; i--) {
			// 跳过拼音占位符位置
			if (hiddenIndices.value.includes(i)) continue;

			const item = newOrder.find(item => item.position === i);
			if (item) {
				// 计算实际移动的目标位置（跳过拼音占位符）
				let newPosition = i + 1;
				// 如果新位置是拼音占位符，继续向后移动
				while (hiddenIndices.value.includes(newPosition) && newPosition < fromIndex) {
					newPosition++;
				}
				// 修复：确保新位置不超过数组边界
				if (newPosition >= 0 && newPosition < currentSentenceWords.value.length) {
					item.position = newPosition;
				} else {
					// 如果新位置无效，保持原位置不变
					item.position = i;
				}
			}
		}
		// 将拖动的词语插入到目标位置
		movedItem.position = toIndex;
	}

	// 添加拖动的词语到新位置
	newOrder.push(movedItem);

	// 按位置排序
	newOrder.sort((a, b) => a.position - b.position);
	userOrder.value = newOrder;

	// 更新错误索引
	if (errorIndices.value.length > 0) {
		const newErrorIndices = [...errorIndices.value];

		if (fromIndex < toIndex) {
			// 向后拖动：错误索引更新
			newErrorIndices.forEach((errorIndex, i) => {
				if (errorIndex === fromIndex) {
					newErrorIndices[i] = toIndex;
				} else if (errorIndex > fromIndex && errorIndex <= toIndex) {
					// 跳过拼音占位符
					if (hiddenIndices.value.includes(errorIndex)) {
						return; // 拼音占位符的错误索引保持不变
					}
					newErrorIndices[i] = errorIndex - 1;
				}
			});
		} else {
			// 向前拖动：错误索引更新
			newErrorIndices.forEach((errorIndex, i) => {
				if (errorIndex === fromIndex) {
					newErrorIndices[i] = toIndex;
				} else if (errorIndex >= toIndex && errorIndex < fromIndex) {
					// 跳过拼音占位符
					if (hiddenIndices.value.includes(errorIndex)) {
						return; // 拼音占位符的错误索引保持不变
					}
					newErrorIndices[i] = errorIndex + 1;
				}
			});
		}

		errorIndices.value = newErrorIndices;
	}
};

// 修改：学习进度存储键名（基于计划ID）
const getProgressKey = () => `learningProgress_${planId.value}`;

// 修改：保存学习进度函数
const saveProgress = () => {
	const progress = {
		planId: planId.value,
		currentSentenceIndex: currentSentenceIndex.value,
		totalSentences: sentences.value.length,
		difficulty: difficulty.value,
		totalGameTime: totalGameTime.value, // 保存总游戏时长
		planStartTime: planStartTime.value, // 保存计划开始时间
		lastUpdateTime: new Date().toISOString(),
		errorCount: errorCount.value, // 保存错误次数
	};
	uni.setStorageSync(getProgressKey(), progress);
};

// 修改：恢复学习进度函数
const restoreProgress = (): boolean => {
	const progress = uni.getStorageSync(getProgressKey());
	if (progress && progress.planId === planId.value) {
		// 检查进度是否有效
		if (progress.currentSentenceIndex >= 0 && progress.currentSentenceIndex < sentences.value.length) {
			currentSentenceIndex.value = progress.currentSentenceIndex;
			difficulty.value = progress.difficulty;
			errorCount.value = progress.errorCount | 0;

			// 恢复总游戏时长和计划开始时间
			if (progress.totalGameTime && progress.planStartTime) {
				totalGameTime.value = progress.totalGameTime;
				planStartTime.value = progress.planStartTime;

				// 如果计划还在进行中，继续计时
				if (currentSentenceIndex.value < sentences.value.length - 1) {
					startTimer();
				}
			}
			return true;
		}
	}
	return false;
};

// 修改：清除学习进度函数
const clearProgress = () => {
	uni.removeStorageSync(getProgressKey());
	totalGameTime.value = 0;
	planStartTime.value = 0;
	stopTimer();
};

// 新增函数 - 合并单字到上一个词
const mergeSingleCharacters = (words: string[]): string[] => {
	const mergedWords: string[] = [];

	for (let i = 0; i < words.length; i++) {
		const currentWord = words[i];
		const lastWord = mergedWords[mergedWords.length - 1];

		// 如果是单字且在合并列表中，且不是第一个词
		let merge = false;
		if (lastWord && (lastWord.length <= 1 || /[\d]$/.test(lastWord)) && currentWord.length == 1) {
			merge = true;
		}
		if (merge && mergedWords.length > 0) {
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

// 修改loadSentences函数
const loadSentences = () => {
	const plans = uni.getStorageSync("plans") || [];
	const articles = uni.getStorageSync("articles") || []; // 获取文章数据
	const plan = plans.find((p: any) => p.id === planId.value);

	if (plan && plan.items && plan.items.length > 0) {
		// 清空之前的句子
		sentences.value = [];

		// 处理每个计划项
		plan.items.forEach((item: any) => {
			// 如果是文章类型，根据articleId查找文章内容
			const article = articles.find((a: any) => a.id === item.articleId);

			let content = "";
			// 根据不同类型获取内容
			if (item.type === 'article') {
				if (article) {
					content = article.content;
				}
			} else if (item.type === 'paragraph') {
				let paragraphSentences = (article.content as string).split('\n').filter(p => p.trim().length > 0);
				content = (item.paragraphIndices as number[]).map(index => paragraphSentences[index]).join('\n');
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
			// 尝试恢复学习进度
			const hasProgress = restoreProgress();

			if (!hasProgress) {
				currentSentenceIndex.value = 0;
			}

			startRecitation();
		}
	}
};

// 修改startRecitation函数，确保计时器正确启动
const startRecitation = () => {
	// 重置显示答案标记
	showAnswerFlag.value = false;

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
	// 不隐藏第一个和最后一个单词
	if (indices.length > 2) {
		// 移除第一个和最后一个索引，确保它们不会被隐藏
		indices.shift(); // 移除第一个元素（索引0）
		indices.pop();   // 移除最后一个元素
	}
	for (let i = 0; i < hideCount; i++) {
		const randomIndex = Math.floor(Math.random() * indices.length);
		hiddenIndices.value.push(indices[randomIndex]);
	}

	shuffledWords.value = shuffleArray(words.value.filter((_, index) => !hiddenIndices.value.includes(index)));
	userOrder.value = [];

	// 新增：默认将第一个单词显示到排序区
	if (words.value.length > 0) {
		const firstWord = words.value[0];
		// 确保第一个位置不是拼音输入框
		if (!hiddenIndices.value.includes(0)) {
			userOrder.value.push({ position: 0, word: firstWord });
			// 从可用词语中移除第一个单词
			const wordIndex = shuffledWords.value.indexOf(firstWord);
			if (wordIndex > -1) {
				shuffledWords.value.splice(wordIndex, 1);
			}
		}
	}

	startTime.value = Date.now();
	showPinyinInput.value = false;

	updateEmptyIndices();

	// 新增 - 重置状态
	isCompleted.value = false;
	startTime.value = Date.now();
	errorIndices.value = []; // 重置错误索引
	userPinyinInputs.value = {}; // 重置拼音输入

	// 新增 - 重置拖动状态
	isDragging.value = false;
	draggingIndex.value = -1;
	dragOverIndex.value = -1;
	dragStartY.value = 0;

	// 修改：启动计时器（记录整个计划的总时长）
	startTimer();

	// 新增 - 保存当前进度
	saveProgress();
};
// 新增：检查所有拼音输入是否正确
const checkPinyinInputs = (): boolean => {
	let allCorrect = true;

	for (const index of hiddenIndices.value) {
		const word = currentSentenceWords.value[index];
		const userInput = userPinyinInputs.value[index] || "";

		// 使用 pinyin-pro 获取拼音首字母
		const correctPinyin = pinyin(word, {
			pattern: 'first',
			toneType: 'none'
		}).replace(/\s+/g, '');

		if (userInput.toLowerCase() !== correctPinyin.toLowerCase()) {
			allCorrect = false;
			if (userInput) {
				// 记录错误的拼音输入框索引
				errorIndices.value.push(index);
				// 显示错误提示
				uni.showToast({
					title: `拼音首字母错误: ${userInput} => ${correctPinyin}`,
					icon: "none"
				});
			}
		}
	}

	return allCorrect;
};

// 修改shuffleArray函数，添加进度保存
const shuffleArray = (array: string[]) => {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
};
// 修改checkAnswer函数，保存答题记录时包含总游戏时长
const checkAnswer = () => {
	// 如果显示了答案，不允许检查
	if (showAnswerFlag.value) {
		nextSentence();
		return;
	}
	const time = Date.now() - startTime.value;

	// 获取正确的词语顺序（排除隐藏的拼音输入位置）
	const correctOrder = currentSentenceWords.value.filter((e, i) => !hiddenIndices.value.includes(i));

	// 获取用户已放置的词语（按位置排序）
	const userWords = userOrder.value
		.sort((a, b) => a.position - b.position)
		.map(item => item.word);

	let correct = userWords.join("") === correctOrder.join("");
	// 重置错误索引
	errorIndices.value = [];
	//检查拼音输入是否正确
	correct = checkPinyinInputs() && correct;

	if (correct) {
		isCompleted.value = true;
		// 答案正确时，显示完整句子
		displayWords.value = [...currentSentenceWords.value];

		// 新增：显示进度提示
		showProgressHintMessage(`答案正确！用时：${formatTime(time)}}`);


		const record = {
			planId: planId.value,
			sentenceIndex: currentSentenceIndex.value,
			correct,
			time,
			totalGameTime: totalGameTime.value, // 保存总游戏时长
			date: new Date().toISOString(),
		};
		const records = uni.getStorageSync("recitationRecords") || [];
		records.push(record);
		uni.setStorageSync("recitationRecords", records);
		// 延迟自动进入下一句
		if (currentSentenceIndex.value < sentences.value.length - 1) {
			nextSentence();
		} else {
			// 如果是最后一题，显示完成信息并清除进度
			uni.showToast({
				title: "已完成所有题目！",
				icon: "success"
			});
		};
	} else {
		// 答案错误时，标记错误的词语
		const minLength = Math.min(userWords.length, correctOrder.length);

		// 检查每个位置的词语是否正确
		for (let i = 0; i < minLength; i++) {
			if (userWords[i] !== correctOrder[i]) {
				// 找到错误的词语的索引
				const pos = currentSentenceWords.value.findIndex(item => item === correctOrder[i]);
				if (pos >= 0) {
					errorIndices.value.push(pos);
				}
			}
		}
	}
};

// 修改nextSentence函数，添加显示答案的记录
const nextSentence = () => {
	// 如果当前显示了答案，记录为错误
	if (showAnswerFlag.value) {
		const record = {
			planId: planId.value,
			sentenceIndex: currentSentenceIndex.value,
			correct: false, // 标记为错误
			time: 0, // 显示答案不计时
			totalGameTime: totalGameTime.value,
			date: new Date().toISOString(),
			showAnswer: true // 标记为显示答案
		};
		const records = uni.getStorageSync("recitationRecords") || [];
		records.push(record);
		uni.setStorageSync("recitationRecords", records);

		// 重置显示答案标记
		showAnswerFlag.value = false;
	}

	if (currentSentenceIndex.value < sentences.value.length - 1) {
		currentSentenceIndex.value++;
		startRecitation();
		// 保存进度
		saveProgress();
	}
};

// 修改prevSentence函数，重置显示答案标记
const prevSentence = () => {
	// 重置显示答案标记
	showAnswerFlag.value = false;

	if (currentSentenceIndex.value > 0) {
		currentSentenceIndex.value--;
		startRecitation();
		// 保存进度
		saveProgress();
	}
};

// 修改setDifficulty函数，添加进度保存
const setDifficulty = (level: 'easy' | 'medium' | 'hard') => {
	difficulty.value = level;
	startRecitation();
	// 保存进度
	saveProgress();
};

// 添加辅助函数 - 获取指定位置的用户词语
const getUserWordAtPosition = (position: number): string | null => {
	const item = userOrder.value.find(item => item.position === position);
	return item ? item.word : null;
};

// 修改addWord函数 - 简化逻辑
const addWord = (word: string) => {
	if (isDragging.value) return;

	// 找到第一个可用的空位置（非拼音输入框位置）
	for (let i = 0; i < currentSentenceWords.value.length; i++) {
		if (hiddenIndices.value.includes(i)) continue; // 跳过拼音输入框位置
		if (!getUserWordAtPosition(i)) {
			// 找到空位置，添加词语
			userOrder.value.push({ position: i, word });

			// 从可用词语中移除
			const wordIndex = shuffledWords.value.indexOf(word);
			if (wordIndex > -1) {
				shuffledWords.value.splice(wordIndex, 1);
			}
			return;
		}
	}

	uni.showToast({ title: '没有可用的位置添加词语', icon: 'none' });
};

// 修改removeWord函数
const removeWord = (word: string) => {
	if (isDragging.value) return;

	const index = userOrder.value.findIndex(item => item.word === word);
	if (index > -1) {
		userOrder.value.splice(index, 1);
		shuffledWords.value.push(word);
	}
};

// 更新空位置计算
const updateEmptyIndices = () => {
	const usedPositions = userOrder.value.map(item => item.position);
	const allPositions = Array.from({ length: currentSentenceWords.value.length }, (_, i) => i);

	// 排除已使用的和拼音输入框位置
	emptyIndices.value = allPositions.filter(pos =>
		!usedPositions.includes(pos) && !hiddenIndices.value.includes(pos)
	);
};


// 显示拼音输入框
const showInput = (index: number) => {
	currentWordIndex.value = index;
	currentWord.value = words.value[index];
	showPinyinInput.value = true;
	pinyinInput.value = "";
};

// 显示答案
const showAnswer = () => {
	if (showAnswerFlag.value) return;
	
	// 显示正确答案
	const correctOrder = currentSentenceWords.value;

	// 清空用户当前顺序
	userOrder.value = [];

	// 将正确答案填充到用户顺序中
	correctOrder.forEach((word, index) => {
		// 跳过拼音输入框位置
		if (!hiddenIndices.value.includes(index)) {
			userOrder.value.push({ position: index, word });
		}
	});

	// 清空可用词语
	shuffledWords.value = [];

	// 设置显示答案标记
	showAnswerFlag.value = true;
	errorCount.value++;
};


// 新增：重置学习进度
const resetProgress = () => {
	uni.showModal({
		title: '确认重置',
		content: '确定要重新开始学习吗？当前进度将被清除。',
		success: (res) => {
			if (res.confirm) {
				clearProgress();
				currentSentenceIndex.value = 0;
				startRecitation();
				uni.showToast({
					title: '已重新开始学习',
					icon: 'success'
				});
			}
		}
	});
};

// 新增：处理拼音输入事件
const onPinyinInput = (index: number) => {
	// 可以在这里添加实时验证或其他逻辑
	console.log(`用户在索引 ${index} 处输入了拼音: ${userPinyinInputs.value[index]}`);
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
	align-items: center;
	margin-bottom: 30rpx;
	padding: 30rpx;
	border-radius: 20rpx;
	background: linear-gradient(90deg, #4b6cb7 0%, #182848 100%);
	box-shadow: 0 6rpx 12rpx rgba(0, 0, 0, 0.15);
	gap: 20rpx
}

.header-actions {
	flex: 1;
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

.sentence-err-num {
	color: #e64340;
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

.available-words,
.user-order {
	margin-bottom: 30rpx;
}


.word-list {
	display: flex;
	flex-wrap: wrap;
	gap: 20rpx;
	margin-top: 15rpx;
	align-items: center;
	/* 添加这行以确保垂直对齐 */
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
}

/* 统一占位符样式，确保对齐 */
.sort-placeholder,
.pinyin-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 120rpx;
	height: 80rpx;
	margin: 5rpx;
	padding: 15rpx 25rpx;
	border-radius: 12rpx;
	font-size: 30rpx;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.08);
	border: 1px solid #bdbdbd;
	background: linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%);
	color: #666;
	text-align: center;
	box-sizing: border-box;
}

.sort-placeholder {
	/* 排序占位符特定样式 */
	text-decoration: underline;
	text-decoration-color: #666;
	text-decoration-thickness: 2rpx;
}

.pinyin-placeholder {
	/* 拼音占位符特定样式 */
	background: linear-gradient(135deg, #3498db 0%, #2c3e50 100%);
	border: 2px solid #3498db;
	color: white;
	box-shadow: 0 4rpx 8rpx rgba(52, 152, 219, 0.3);
}

.pinyin-placeholder:hover {
	box-shadow: 0 6rpx 12rpx rgba(52, 152, 219, 0.4);
}

.pinyin-placeholder::before {
	content: "□";
	color: white;
	font-size: 32rpx;
	font-weight: bold;
}

.placeholder-item {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 120rpx;
	height: 80rpx;
	margin: 5rpx;
}

.placeholder-underline {
	padding: 15rpx 25rpx;
	background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
	color: white;
	border-radius: 12rpx;
	font-size: 30rpx;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 4rpx 8rpx rgba(76, 175, 80, 0.3);
	border: 1px solid #4caf50;
	text-decoration: underline;
	text-decoration-color: white;
	text-decoration-thickness: 2rpx;
}

.placeholder-box {
	width: 80rpx;
	height: 80rpx;
	background: linear-gradient(135deg, #3498db 0%, #2c3e50 100%);
	border: 2px solid #3498db;
	border-radius: 12rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 4rpx 8rpx rgba(52, 152, 219, 0.3);
}

.placeholder-box:hover {
	box-shadow: 0 6rpx 12rpx rgba(52, 152, 219, 0.4);
}

.placeholder-text {
	color: white;
	font-size: 32rpx;
	font-weight: bold;
}

.pinyin-text {
	color: white;
	font-size: 24rpx;
	font-weight: bold;
}

/* 新增：拖动样式优化 */
.dragging {
	opacity: 0.7;
	z-index: 1000;
	box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.3) !important;
}

.drag-over {
	background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%) !important;
}

/* 防止拖动时页面滚动 */
.word-list,
.placeholder-container {
	touch-action: pan-y;
	-webkit-user-select: none;
	user-select: none;
}

/* 拼音输入区特殊样式，明确标识不可拖放 */
.pinyin-input-wrapper {
	background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%) !important;
	border: 2px dashed #4caf50 !important;
	outline: 0;
	border-radius: 12rpx;
	padding: 10rpx;
}

.pinyin-input-wrapper .direct-pinyin-input {
	width: 100%;
	height: 60rpx;
	border: none;
	background: transparent;
	text-align: center;
	font-size: 28rpx;
	color: #2e7d32;
	font-weight: 500;
}

/* 新增：错误词语样式 */
.error-word {
	background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%) !important;
	color: white !important;
	box-shadow: 0 4rpx 8rpx rgba(244, 67, 54, 0.3) !important;
	border: 2px solid #f44336 !important;
	outline: 2px solid #f44336 !important;
	animation: shake 0.5s ease-in-out;
}

/* 拖动时占位符容器样式优化 */
.placeholder-container {
	min-height: 80rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.2s ease;
}

/* 拖动时可用词语区域样式 */
.available-words .word-item.dragging {
	background: linear-gradient(135deg, #ffecb3 0%, #ffd54f 100%) !important;
	color: #ff6f00 !important;
	border-color: #ffb300 !important;
}

/* 拖动时用户排序区域样式 */
.user-order .word-item.dragging {
	background: linear-gradient(135deg, #ffecb3 0%, #ffd54f 100%) !important;
	color: #1b5e20 !important;
	border-color: #4caf50 !important;
}

/* 新增：拖动相关样式 */
.draggable-word {
	position: relative;
	user-select: none;
	-webkit-user-select: none;
	touch-action: none;
}

.draggable-word.dragging {
	z-index: 1000;
	box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.3);
	opacity: 0.8;
	transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.draggable-word.drag-over {
	position: relative;
	box-shadow: 0 6rpx 15rpx rgba(255, 193, 7, 0.4);
}

/* 改进：用户排序区域拖放目标样式 */
.placeholder-container.drag-over {
	position: relative;
	outline: 3px dashed #4caf50;
	border-radius: 12rpx;
	background: rgba(76, 175, 80, 0.2);
	transition: all 0.2s ease;
	transform: scale(1.05);
	z-index: 10;
}

.placeholder-container.drag-over::after {
	content: "↓";
	position: absolute;
	top: -35rpx;
	left: 50%;
	transform: translateX(-50%);
	color: #4caf50;
	font-size: 28rpx;
	font-weight: bold;
	background: white;
	padding: 5rpx 10rpx;
	border-radius: 8rpx;
	box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.2);
}

/* 新增：拖动提示样式 */
.drag-hint {
	display: block;
	font-size: 26rpx;
	color: #666;
	margin: 10rpx 0 20rpx 0;
	padding: 10rpx 15rpx;
	background: #f8f9fa;
	border-radius: 8rpx;
	border-left: 4rpx solid #3498db;
}

/* 改进：可用词语拖动时的特殊样式 */
.word-item:not(.user-word).dragging {
	background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%) !important;
	color: white !important;
	box-shadow: 0 8rpx 20rpx rgba(255, 152, 0, 0.4) !important;
	z-index: 1000;
	transform: scale(1.1);
	transition: transform 0.2s ease;
}

.word-item:hover {
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

/* 新增：拼音输入框容器样式 */
.pinyin-input-wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 80rpx;
	height: 80rpx;
}

.direct-pinyin-input {
	width: 100%;
	height: 100%;
	border: 2px solid #3498db;
	border-radius: 12rpx;
	text-align: center;
	font-size: 28rpx;
	background: #f8f9fa;
	box-sizing: border-box;
}

.direct-pinyin-input:focus {
	border-color: #2c3e50;
	outline: none;
	box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.sort-placeholder {
	padding: 15rpx 25rpx;
	background: linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%);
	color: #666;
	border-radius: 12rpx;
	font-size: 30rpx;
	font-weight: 500;
	cursor: default;
	transition: all 0.3s ease;
	box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.08);
	border: 1px solid #bdbdbd;
	text-align: center;
	min-width: 120rpx;
}

.pinyin-placeholder {
	width: 80rpx;
	height: 80rpx;
	background: linear-gradient(135deg, #3498db 0%, #2c3e50 100%);
	border: 2px solid #3498db;
	border-radius: 12rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 4rpx 8rpx rgba(52, 152, 219, 0.3);
}

.pinyin-placeholder:hover {
	box-shadow: 0 6rpx 12rpx rgba(52, 152, 219, 0.4);
}

.pinyin-placeholder::before {
	content: "□";
	color: white;
	font-size: 32rpx;
	font-weight: bold;
}

/* 新增：答题时间显示样式 */
.time-display {
	flex: 1;
	font-size: 14px;
	color: #bbb;
	margin-right: 10px;
	text-align: right;
}

/* 新增：进度提示样式 */
.progress-hint {
	position: fixed;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	background-color: rgba(0, 0, 0, 0.5);
	color: white;
	padding: 15px 20px;
	border-radius: 8px;
	z-index: 1000;
	text-align: center;
}

.hint-text {
	font-size: 16px;
	font-weight: bold;
}
</style>