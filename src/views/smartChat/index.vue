<template>
  <div class="app-container">
    <!-- 核心内容区：会话栏 + 聊天区（同一页面横向排列） -->
    <div class="core-content">
      <!-- 左侧历史会话栏 -->
      <div class="chat-sidebar">
        <div class="sidebar-header">
          <h3>历史会话</h3>
          <!-- 搜索框 -->
          <el-input
            v-model="searchKeyword"
            placeholder="搜索会话..."
            class="search-input"
            @keyup.enter="searchConversations"
            :size="formSize"
          />
          <!-- 新建会话按钮 -->
          <el-button 
            icon="el-icon-plus" 
            type="primary" 
            @click="createNewConversation"
            :size="formSize"
          >
            新会话
          </el-button>
        </div>
        <!-- 会话列表 -->
        <div class="conversation-list">
          <div
            v-for="(conv, index) in filteredConversations"
            :key="conv.uid"
            :class="['conversation-item', currentUid === conv.uid ? 'active' : '']"
            @click="switchConversation(conv.uid)"
          >
            <div class="conv-title">{{ conv.title || '未命名会话' }}</div>
            <div class="conv-time">{{ formatTime(conv.createTime) }}</div>
            <!-- 删除按钮 -->
            <el-button
              icon="el-icon-delete"
              class="delete-btn"
              @click.stop="deleteConversation(conv.uid)"
              :size="formSize"
            />
          </div>
          <!-- 无会话提示 -->
          <div class="no-conversation" v-if="filteredConversations.length === 0 && !isLoading">
            暂无会话，点击"新会话"开始聊天
          </div>
        </div>
      </div>

      <!-- 右侧聊天区域 -->
      <div class="chat-main">
        <!-- 未选择会话 + 无会话 占位提示 -->
        <div class="chat-placeholder" v-if="(!currentUid && !isLoading) || (filteredConversations.length === 0 && !isLoading)">
          <div class="placeholder-icon">🤖</div>
          <div class="placeholder-text">
            <span v-if="filteredConversations.length === 0">暂无历史会话</span>
            <span v-else>请选择一个会话开始聊天</span>
          </div>
          <el-button 
            type="primary" 
            @click="createNewConversation"
            :size="formSize"
            v-if="filteredConversations.length === 0"
          >
            创建第一个会话
          </el-button>
        </div>

        <!-- 已选择会话时显示聊天内容 -->
        <div class="chat-container" v-else-if="currentUid && !isLoading">
          <div class="chat-header">
            <h3 class="chat-title">{{ currentConvTitle || '农业智能小助手' }}</h3>
          </div>

          <!-- 聊天消息区 -->
          <div class="chat-messages" ref="messageContainer">
            <!-- 消息列表 -->
            <div
              v-for="(msg, index) in messages"
              :key="msg.id"
              :class="['message', msg.role === 'user' ? 'user-message' : 'assistant-message']"
            >
              <div class="message-content">
                <div class="avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
                <div class="message-body">
                  <div class="text">{{ msg.content }}</div>
                  <div class="msg-time">{{ formatTime(msg.createTime) }}</div>
                </div>
              </div>
            </div>
            <!-- 加载中提示 -->
            <div v-if="loading" class="message assistant-message">
              <div class="message-content">
                <div class="avatar">🤖</div>
                <div class="text">
                  <el-loading-spinner class="loading-spinner" :size="20" />
                  <span class="loading-text">思考中...</span>
                </div>
              </div>
            </div>
            <!-- 无消息提示 -->
            <div class="no-message" v-if="messages.length === 0 && !loading">
              该会话暂无消息，输入问题开始交流吧~
            </div>
          </div>

          <!-- 推荐问题（仅初始会话显示） -->
          <div class="suggested-questions" v-if="messages.length === 0 && !loading">
            <div class="suggested-title">猜你想问</div>
            <div class="suggested-list">
              <div
                v-for="(q, index) in suggestedQuestions"
                :key="index"
                class="suggested-item"
                @click="selectQuestion(q)"
              >
                {{ q }}
              </div>
            </div>
          </div>

          <!-- 输入区 -->
          <div class="chat-input">
            <el-input
              v-model="userInput"
              type="textarea"
              :rows="3"
              placeholder="请输入您的问题（Ctrl+Enter发送）..."
              @keyup.enter.ctrl="sendMessage"
              :size="formSize"
              :disabled="loading"
            />
            <el-button
              type="primary"
              :loading="loading"
              @click="sendMessage"
              :disabled="!userInput.trim() || loading"
              :size="formSize"
            >
              发送
            </el-button>
          </div>
        </div>

        <!-- 页面初始化加载状态 -->
        <div class="page-loading" v-if="isLoading">
          <el-loading-spinner :size="40" />
          <div class="loading-text">加载中...</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const apiKey = 'sk-3rG1hl3sdDbbRoqEHr7utZpcbqbufy1miSD9XhLvVxJGAb4W';
import { ref, onMounted, nextTick,watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Session } from '/@/utils/storage';
import { storeToRefs } from 'pinia';
import { useThemeConfig } from '/@/stores/themeConfig';
import request from '/@/utils/request';
import axios from 'axios';
import type { ComponentSize } from 'element-plus';

// 定义接口类型（TS类型约束）
interface Conversation {
  uid: string;
  userId: string | number;
  title: string;
  createTime: string;
  updateTime?: string;
}

interface Message {
  id: string | number;
  uid: string;
  userId: string | number;
  role: 'user' | 'assistant';
  content: string;
  createTime: string;
}

// 全局状态与路由
const storesThemeConfig = useThemeConfig();
const { themeConfig } = storeToRefs(storesThemeConfig);
const router = useRouter();
const formSize = ref<ComponentSize>('default');

// 响应式数据
const currentUserId = ref<string>(''); // 存储user表真实ID
const messages = ref<Message[]>([]); // 当前会话消息列表
const userInput = ref<string>(''); // 输入框内容
const loading = ref<boolean>(false); // 消息发送加载状态
const isLoading = ref<boolean>(true); // 页面初始化加载状态
const currentUid = ref<string>(''); // 当前选中的会话ID
const currentConvTitle = ref<string>(''); // 当前会话标题
const searchKeyword = ref<string>(''); // 搜索关键词
const conversations = ref<Conversation[]>([]); // 所有会话列表
const filteredConversations = ref<Conversation[]>([]); // 搜索过滤后的会话
watch(searchKeyword, (newVal) => {
  if (!newVal.trim()) {
    filteredConversations.value = [...conversations.value];
  }
});
// 推荐问题列表（农业相关）
const suggestedQuestions = ref<string[]>([
  '如何防治水稻病害？',
  '玉米常见病虫害有哪些？',
  '小麦生长周期是多少天？',
  '如何提高农作物产量？',
  '农药使用注意事项有哪些？',
  '农作物施肥的最佳时间？',
  '如何识别植物病害症状？',
  '大棚蔬菜浇水技巧？',
  '病虫害绿色防控方法？'
]);

// 工具方法：格式化时间
const formatTime = (timeStr: string): string => {
  if (!timeStr) return '未知时间';
  // 处理 UTC 格式（将 +00:00 替换为 Z，浏览器可正常解析）
  const standardizedTime = timeStr.replace(/\+00:00$/, 'Z');
  const date = new Date(standardizedTime);
  // 校验解析结果，避免 Invalid Date 导致的异常
  if (isNaN(date.getTime())) return '未知时间';
  // 转换为本地时区，避免时间差问题
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false // 强制 24 小时制，避免上午/下午显示混乱
  });
};

// 工具方法：滚动到最新消息
const scrollToBottom = () => {
  const container = document.querySelector('.chat-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
};

// 核心功能：加载当前用户的会话
const loadUserConversations = async () => {
  if (!currentUserId.value) return;
  isLoading.value = true;
  try {
    const res = await request.get('/api/conversations', {
      params: { userId: currentUserId.value }, // 用user表真实ID筛选
    });
    const data = res.data as unknown as Conversation[];
    conversations.value = data;
    filteredConversations.value = [...data];
    // 自动选中第一个会话（如有）
    if (data.length > 0 && !currentUid.value) {
      switchConversation(data[0].uid);
    }
  } catch (err) {
    ElMessage.error('加载会话失败，请刷新重试');
    console.error('加载会话错误:', err);
  } finally {
    isLoading.value = false;
  }
};
/*
// 核心功能：创建新会话
const createNewConversation = async () => {
  if (!currentUserId.value) {
    ElMessage.warning('请先登录');
    return;
  }
  loading.value = true;
  try {
    const res = await request.post('/api/conversations', {
      userId: currentUserId.value,
      title: '新会话',
    });
    const newUid = res.data.uid as string;
    currentUid.value = newUid;
    currentConvTitle.value = '新会话';
    messages.value = [];
    loadUserConversations(); // 刷新会话列表
    ElMessage.success('会话创建成功');
  } catch (err) {
    ElMessage.error('创建会话失败');
    console.error('创建会话错误:', err);
  } finally {
    loading.value = false;
  }
};
*/
const createNewConversation = async () => {
  if (!currentUserId.value) {
    ElMessage.warning('请先登录');
    return;
  }
  loading.value = true;
  try {
    console.log('开始创建新会话...');
    const res = await request.post('/api/conversations', {
      userId: currentUserId.value,
      title: '新会话',
    });
    
    // 关键日志：打印完整的响应对象
    console.log('创建会话请求的完整响应:', res);
    
    // 从响应中提取 uid
    // 请根据你实际的后端返回格式修改这一行！
    // 如果后端返回 { "uid": "xxx" }, 则用 res.uid
    // 如果后端返回 { "data": { "uid": "xxx" } }, 则用 res.data.uid
    const newConv = res.data as unknown as Conversation; // 正确：res.data是新会话对象
    const newUid = newConv.uid; // 从会话对象中取uid // 从会话对象中取uid

    // 关键日志：打印提取到的 uid
    console.log('从响应中提取到的 newUid:', newUid);

    if (!newUid) {
      throw new Error('创建会话成功，但未返回有效的 uid');
    }

    currentConvTitle.value = '新会话';
    messages.value = [];
    
    console.log('准备刷新会话列表...');
    await loadUserConversations();
    console.log('会话列表刷新成功');

    const targetConv = conversations.value.find(conv => conv.uid === newUid); // 二次声明（修改）
  console.log('在刷新后的列表中查找新会话:', targetConv);
  if (targetConv) { // 同步修改判断条件
    currentUid.value = newUid;
    ElMessage.success('会话创建成功');
  } else {
    ElMessage.warning('会话创建成功，但未在列表中找到，请手动刷新');
  }
  } catch (err) {
    // 关键日志：打印详细的错误信息
    console.error('创建会话过程中发生错误:', err);
    ElMessage.error('会话创建异常，请检查控制台日志');
  } finally {
    loading.value = false;
  }
};
// 核心功能：切换会话
const switchConversation = async (uid: string) => {
  if (currentUid.value === uid) return;
  currentUid.value = uid;
  loading.value = true;
  try {
    const res = await request.get('/api/messages', { params: { uid } });
    messages.value = res.data as unknown as Message[]; 
    // 更新会话标题
    const currConv = conversations.value.find(c => c.uid === uid);
    currentConvTitle.value = currConv?.title || '未命名会话';
    nextTick(scrollToBottom);
  } catch (err) {
    ElMessage.error('加载消息失败');
    console.error('加载消息错误:', err);
  } finally {
    loading.value = false;
  }
};

// 核心功能：删除会话
const deleteConversation = async (uid: string) => {
  if (!confirm('确定删除该会话吗？删除后不可恢复')) return;
  try {
    await request.delete(`/api/conversations/${uid}`);
    // 若删除当前会话，清空状态
    if (currentUid.value === uid) {
      currentUid.value = '';
      currentConvTitle.value = '';
      messages.value = [];
    }
    loadUserConversations(); // 刷新会话列表
    ElMessage.success('会话删除成功');
  } catch (err) {
    ElMessage.error('删除会话失败');
    console.error('删除会话错误:', err);
  }
};

// 核心功能：搜索会话
const searchConversations = async () => {
  const keyword = searchKeyword.value.trim();
  if (!keyword) {
    filteredConversations.value = [...conversations.value];
    return;
  }
  try {
    const res = await request.get('/api/conversations/search', {
      params: {
        userId: currentUserId.value,
        keyword,
      },
    });
    filteredConversations.value = res.data as unknown as Conversation[];
  } catch (err) {
    ElMessage.error('搜索失败');
    console.error('搜索错误:', err);
  }
};

// 核心功能：选择推荐问题
const selectQuestion = (question: string) => {
  userInput.value = question;
  sendMessage();
};

// 核心功能：发送消息
const sendMessage = async () => {
  const content = userInput.value.trim();
  // 新增：校验 currentUid 非空
  if (!content || loading.value || !currentUid.value || !currentUserId.value) {
    // 新增提示：未选择会话时
    if (!currentUid.value && content) ElMessage.warning('请先创建或选择一个会话');
    return;
  }

  // 临时添加用户消息（优化体验）
  const tempMsg: Message = {
    id: Date.now(),
    uid: currentUid.value,
    userId: currentUserId.value,
    role: 'user',
    content,
    createTime: new Date().toISOString(),
  };
  messages.value.push(tempMsg);
  userInput.value = '';
  loading.value = true;
  scrollToBottom();

  try {
    // 1. 保存用户消息到后端
    const userMsgRes = await request.post('/api/messages', {
      uid: currentUid.value,
      userId: currentUserId.value,
      role: 'user',
      content,
    });

    // 2. 调用GPT接口获取回复
    const gptRes = await axios.post('https://api.chatanywhere.tech/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: messages.value.map(msg => ({ role: msg.role, content: msg.content })),
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`, // 直接使用定义的apiKey
        'Content-Type': 'application/json',
      },
    });
    const assistantContent = gptRes.data.choices[0].message.content as string;
    // 3. 保存助手回复到后端
    const assistantMsgRes = await request.post('/api/messages', {
      uid: currentUid.value,
      userId: currentUserId.value,
      role: 'assistant',
      content: assistantContent,
    });

    // 4. 更新消息列表（替换临时消息ID，添加助手回复）
    messages.value = messages.value.map(msg =>
      msg.id === tempMsg.id ? (userMsgRes.data as Message) : msg
    );
    messages.value.push(assistantMsgRes.data as Message);

    // 5. 首次消息时更新会话标题（取用户消息前20字）
    if (messages.value.length === 2) {
      const newTitle = content.length > 20 ? content.slice(0, 20) + '...' : content;
      await request.put(`/api/conversations/${currentUid.value}/title`, { title: newTitle });
      currentConvTitle.value = newTitle;
      loadUserConversations(); // 刷新会话列表标题
    }

  } catch (err) {
    ElMessage.error('发送失败，请稍后重试');
    console.error('发送消息错误:', err);
    messages.value.pop(); // 移除临时消息
  } finally {
    loading.value = false;
    nextTick(scrollToBottom);
  }
};

// 页面初始化：校验登录状态 + 加载数据
onMounted(() => {
  // 从Session获取登录时存储的user表ID
  const loginUserId = Session.get('loginUserId');
  if (!loginUserId) {
    ElMessage.error('请先登录');
    router.push('/login'); // 未登录跳转登录页
    return;
  }

  // 初始化用户ID和表单大小
  currentUserId.value = loginUserId as string;
  formSize.value = (themeConfig.value as any).formSize || 'default';

  // 加载当前用户的会话
  loadUserConversations();
});
/*onMounted(async () => {
  // 1. 直接硬编码用户ID（跳过Session读取，测试会话加载）
  currentUserId.value = '1'; // 与后端返回的userId一致
  console.log('强制设置currentUserId:', currentUserId.value);

  // 2. 简化表单大小初始化（避免类型错误）
  formSize.value = 'default';

  try {
    // 3. 加载会话（仅保留核心请求）
    const res = await request.get('/api/conversations', {
      params: { userId: currentUserId.value },
    });
     const data = res.data as unknown as Conversation[];
    conversations.value = data;
    filteredConversations.value = [...data];
    console.log('会话加载成功，数据量:', data.length);

    if (data.length > 0) {
      currentUid.value = data[0].uid;
      currentConvTitle.value = data[0].title;
    }
  } catch (err) {
    console.error('简化后加载失败:', err);
    ElMessage.error('会话加载失败');
  } finally {
    isLoading.value = false;
  }
});*/
</script>

<style scoped>
/* 全局容器样式 */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: #f5f7fa;
}

/* 核心内容区：横向排列 */
.core-content {
  display: flex;
  flex: 1;
  height: 100vh;
  overflow: hidden;
}

/* 左侧会话栏样式 */
.chat-sidebar {
  width: 280px;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-shadow: 0 0 10px rgba(0, 0
   0, 0, 0.05);
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #2c3e50;
  text-align: center;
  font-weight: 600;
}

.search-input {
  width: 100%;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
}

.conversation-item {
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  background-color: #f8fafc;
}

.conversation-item:hover {
  background-color: #f0f9ff;
  border-color: #e0f2fe;
}

.conversation-item.active {
  background-color: #e0f2fe;
  border: 1px solid #94a3b8;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.conv-title {
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #1e293b;
  margin-bottom: 4px;
}

.conv-time {
  font-size: 0.75rem;
  color: #64748b;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
  color: #ef4444;
}

.conversation-item:hover .delete-btn {
  opacity: 1;
}

.no-conversation {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
  font-size: 0.9rem;
  background-color: #f8fafc;
  border-radius: 8px;
  margin: 8px;
}

/* 右侧聊天区域样式 */
.chat-main {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%);
}

.chat-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  gap: 20px;
  padding: 20px;
  text-align: center;
}

.placeholder-icon {
  font-size: 4.5rem;
  color: #94a3b8;
}

.placeholder-text {
  font-size: 1.2rem;
  max-width: 400px;
  line-height: 1.6;
  color: #475569;
}

.page-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #64748b;
}

.loading-text {
  font-size: 1rem;
}

/* 聊天容器样式 */
.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid #e5e7eb;
}

.chat-title {
  margin: 0;
  color: #2c3e50;
  font-size: 1.4rem;
  font-weight: 600;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  scroll-behavior: smooth;
}

.message {
  margin-bottom: 20px;
  opacity: 0;
  transform: translateY(20px);
  animation: messageAppear 0.3s ease forwards;
  display: flex;
  width: 100%;
}

@keyframes messageAppear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-content {
  display: flex;
  align-items: flex-start;
  max-width: 75%;
  gap: 12px;
  word-break: break-word;
}

.message-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-message .message-content {
  flex-direction: row-reverse;
  margin-left: auto;
  padding-left: 10%;
}

.assistant-message .message-content {
  margin-right: auto;
  padding-right: 10%;
}

.avatar {
  width: 38px;
  height: 38px;
  min-width: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.text {
  padding: 14px 18px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  line-height: 1.6;
  font-size: 0.95rem;
  flex: 1;
  word-wrap: break-word;
}

.user-message .text {
  background: linear-gradient(135deg, #2f80ed 0%, #56ccf2 100%);
  color: #ffffff;
  border-top-right-radius: 4px;
}

.assistant-message .text {
  border-top-left-radius: 4px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}

.msg-time {
  font-size: 0.75rem;
  color: #64748b;
  align-self: flex-end;
}

.no-message {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
  font-size: 0.95rem;
  background-color: #f8fafc;
  border-radius: 8px;
  margin: 20px auto;
  max-width: 300px;
}

/* 推荐问题样式 */
.suggested-questions {
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
}

.suggested-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: #2c3e50;
}

.suggested-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.suggested-item {
  padding: 8px 16px;
  background: rgba(47, 128, 237, 0.1);
  border-radius: 20px;
  font-size: 0.9rem;
  color: #2f80ed;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.suggested-item:hover {
  background: rgba(47, 128, 237, 0.2);
  transform: translateY(-1px);
  border-color: rgba(47, 128, 237, 0.3);
}

/* 输入区样式 */
.chat-input {
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 -4px 6px rgba(0, 0, 0, 0.05);
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.chat-input :deep(.el-textarea__inner) {
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 12px 16px;
  resize: none;
  min-height: 80px;
  transition: all 0.2s ease;
}

.chat-input :deep(.el-textarea__inner:hover) {
  border-color: #94a3b8;
  box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.1);
}

.chat-input :deep(.el-textarea__inner:focus) {
  border-color: #2f80ed;
  box-shadow: 0 0 0 2px rgba(47, 128, 237, 0.2);
}

.chat-input :deep(.el-button) {
  border-radius: 10px;
  padding: 10px 24px;
  height: auto;
  background: linear-gradient(to right, #2f80ed 0%, #56ccf2 100%);
  border: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.chat-input :deep(.el-button:hover) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(47, 128, 237, 0.2);
  opacity: 0.95;
}

.chat-input :deep(.el-button:active) {
  transform: translateY(0);
}

/* 加载中样式 */
.loading-spinner {
  display: inline-block;
  margin-right: 8px;
  vertical-align: middle;
}

.loading-text {
  vertical-align: middle;
}

/* 滚动条样式优化 */
.chat-messages::-webkit-scrollbar,
.conversation-list::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.chat-messages::-webkit-scrollbar-track,
.conversation-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb,
.conversation-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover,
.conversation-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 响应式适配 */
@media (max-width: 1200px) {
  .chat-sidebar {
    width: 260px;
  }

  .message-content {
    max-width: 80%;
  }
}

@media (max-width: 768px) {
  .core-content {
    flex-direction: column;
  }

  .chat-sidebar {
    width: 100%;
    height: 30%;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
  }

  .chat-main {
    height: 70%;
  }

  .message-content {
    max-width: 90%;
  }

  .chat-messages {
    padding: 16px;
  }

  .chat-input {
    padding: 12px 16px;
  }

  .suggested-questions {
    padding: 12px 16px;
  }
}

@media (max-width: 480px) {
  .sidebar-header {
    padding: 12px;
  }

  .conversation-item {
    padding: 10px 12px;
  }

  .chat-title {
    font-size: 1.2rem;
  }

  .text {
    padding: 12px 14px;
    font-size: 0.9rem;
  }

  .suggested-item {
    padding: 6px 12px;
    font-size: 0.85rem;
  }

  .chat-input :deep(.el-button) {
    padding: 8px 16px;
  }
}
</style>