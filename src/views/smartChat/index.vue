<template>
  <div class="app-container">
    <!-- 核心内容区：会话栏 + 聊天区（同一页面横向排列） -->
    <div class="core-content">
      <!-- ✅ 会话栏折叠/展开按钮（仅 PC 显示） -->
      <div 
        v-if="!isMobile"
        class="sidebar-toggle"
        @click="toggleSidebar"
        :class="{ 'collapsed': isSidebarCollapsed }"
      >
        <span v-if="isSidebarCollapsed">→</span>
        <span v-else>←</span>
      </div>

      <!-- 左侧历史会话栏 -->
      <div 
        class="chat-sidebar" 
        :class="{ 'collapsed': isSidebarCollapsed && !isMobile }"
      >
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
            <!-- 删除按钮（已用 🗑️ 图标） -->
            <el-button
              class="delete-btn"
              @click.stop="showDeleteConfirm(conv.uid)"
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

    <!-- ✅ 自定义确认删除弹窗 -->
    <div class="delete-confirm-modal" v-if="showDeleteModal">
      <div class="delete-modal-overlay" @click="closeDeleteModal"></div>
      <div class="delete-modal-content">
        <div class="delete-modal-header">
          <div class="delete-modal-icon">⚠️</div>
          <h3 class="delete-modal-title">确认删除</h3>
        </div>
        <div class="delete-modal-body">
          <p class="delete-modal-text">确定要删除这个会话吗？</p>
          <p class="delete-modal-warning">删除后将无法恢复，此操作不可撤销。</p>
        </div>
        <div class="delete-modal-footer">
          <el-button 
            @click="closeDeleteModal" 
            :size="formSize"
            class="cancel-btn"
          >
            取消
          </el-button>
          <el-button 
            type="danger" 
            @click="confirmDelete" 
            :size="formSize"
            class="confirm-btn"
          >
            确认删除
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const apiKey = 'sk-3rG1hl3sdDbbRoqEHr7utZpcbqbufy1miSD9XhLvVxJGAb4W';
import { ref, onMounted, nextTick, watch, computed, onUnmounted } from 'vue';
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
const currentUserId = ref<string>('');
const messages = ref<Message[]>([]);
const userInput = ref<string>('');
const loading = ref<boolean>(false);
const isLoading = ref<boolean>(true);
const currentUid = ref<string>('');
const currentConvTitle = ref<string>('');
const searchKeyword = ref<string>('');
const conversations = ref<Conversation[]>([]);
const filteredConversations = ref<Conversation[]>([]);

// ✅ 新增：侧边栏折叠状态 & 移动端判断
const isSidebarCollapsed = ref(false);
const isMobile = computed(() => window.innerWidth <= 768);

// ✅ 新增：删除确认弹窗相关状态
const showDeleteModal = ref(false);
const deleteTargetUid = ref<string>('');

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
  const standardizedTime = timeStr.replace(/\+00:00$/, 'Z');
  const date = new Date(standardizedTime);
  if (isNaN(date.getTime())) return '未知时间';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// 工具方法：滚动到最新消息
const scrollToBottom = () => {
  const container = document.querySelector('.chat-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
};

// ✅ 新增：显示删除确认弹窗
const showDeleteConfirm = (uid: string) => {
  deleteTargetUid.value = uid;
  showDeleteModal.value = true;
};

// ✅ 新增：关闭删除确认弹窗
const closeDeleteModal = () => {
  showDeleteModal.value = false;
  deleteTargetUid.value = '';
};

// ✅ 新增：确认删除
const confirmDelete = async () => {
  if (!deleteTargetUid.value) return;

  try {
    await request.delete(`/api/conversations/${deleteTargetUid.value}`);
    if (currentUid.value === deleteTargetUid.value) {
      currentUid.value = '';
      currentConvTitle.value = '';
      messages.value = [];
    }
    await loadUserConversations();
    ElMessage.success('会话删除成功');
  } catch (err) {
    ElMessage.error('删除会话失败');
    console.error('删除会话错误:', err);
  } finally {
    closeDeleteModal();
  }
};

// 核心功能：加载当前用户的会话
const loadUserConversations = async () => {
  if (!currentUserId.value) return;
  isLoading.value = true;
  try {
    const res = await request.get('/api/conversations', {
      params: { userId: currentUserId.value },
    });
    const data = res.data as unknown as Conversation[];
    conversations.value = data;
    filteredConversations.value = [...data];
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
    const newConv = res.data as unknown as Conversation;
    const newUid = newConv.uid;
    if (!newUid) {
      throw new Error('创建会话成功，但未返回有效的 uid');
    }
    currentConvTitle.value = '新会话';
    messages.value = [];
    await loadUserConversations();
    const targetConv = conversations.value.find(conv => conv.uid === newUid);
    if (targetConv) {
      currentUid.value = newUid;
      ElMessage.success('会话创建成功');
    } else {
      ElMessage.warning('会话创建成功，但未在列表中找到，请手动刷新');
    }
  } catch (err) {
    console.error('创建会话过程中发生错误:', err);
    ElMessage.error('会话创建异常，请检查控制台日志');
  } finally {
    loading.value = false;
  }
};

const switchConversation = async (uid: string) => {
  if (currentUid.value === uid) return;
  currentUid.value = uid;
  loading.value = true;
  try {
    const res = await request.get('/api/messages', { params: { uid } });
    messages.value = res.data as unknown as Message[];
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

const deleteConversation = async (uid: string) => {
  // 原来的函数逻辑现在在 confirmDelete 中实现
  // 这里可以保留作为备用或删除
};

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

const selectQuestion = (question: string) => {
  userInput.value = question;
  sendMessage();
};

const sendMessage = async () => {
  const content = userInput.value.trim();
  if (!content || loading.value || !currentUid.value || !currentUserId.value) {
    if (!currentUid.value && content) ElMessage.warning('请先创建或选择一个会话');
    return;
  }

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
    const userMsgRes = await request.post('/api/messages', {
      uid: currentUid.value,
      userId: currentUserId.value,
      role: 'user',
      content,
    });

    const gptRes = await axios.post('https://api.chatanywhere.tech/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: messages.value.map(msg => ({ role: msg.role, content: msg.content })),
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const assistantContent = gptRes.data.choices[0].message.content as string;

    const assistantMsgRes = await request.post('/api/messages', {
      uid: currentUid.value,
      userId: currentUserId.value,
      role: 'assistant',
      content: assistantContent,
    });

    messages.value = messages.value.map(msg =>
      msg.id === tempMsg.id ? (userMsgRes.data as Message) : msg
    );
    messages.value.push(assistantMsgRes.data as Message);

    if (messages.value.length === 2) {
      const newTitle = content.length > 20 ? content.slice(0, 20) + '...' : content;
      await request.put(`/api/conversations/${currentUid.value}/title`, { title: newTitle });
      currentConvTitle.value = newTitle;
      loadUserConversations();
    }
  } catch (err) {
    ElMessage.error('发送失败，请稍后重试');
    console.error('发送消息错误:', err);
    messages.value.pop();
  } finally {
    loading.value = false;
    nextTick(scrollToBottom);
  }
};

// ✅ 新增：切换侧边栏
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

// 页面初始化 + 响应式监听
onMounted(() => {
  const loginUserId = Session.get('loginUserId');
  if (!loginUserId) {
    ElMessage.error('请先登录');
    router.push('/login');
    return;
  }

  currentUserId.value = loginUserId as string;
  formSize.value = (themeConfig.value as any).formSize || 'default';
  loadUserConversations();

  // 监听窗口大小，小屏强制展开
  const handleResize = () => {
    if (window.innerWidth <= 768 && isSidebarCollapsed.value) {
      isSidebarCollapsed.value = false;
    }
  };
  window.addEventListener('resize', handleResize);

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });
});
</script>

<style scoped>
/* === 农业主题配色 === */
:root {
    --agri-gold: #d4a017;
    --agri-gold-light: #f9f2d5;
    --agri-green: #4caf50;
    --agri-green-light: #e8f5e9;
    --agri-brown: #8d6e63;
    --agri-brown-light: #efebe9;
    --text-primary: #37474f;
    --text-secondary: #607d8b;
    --border-color: #dfe6e9;
    --border-radius-base: 10px;
    --border-radius-sm: 8px;
    --border-radius-lg: 14px;
    --shadow-sm: 0 2px 6px rgba(141, 110, 99, 0.08);
    --shadow-md: 0 4px 12px rgba(141, 110, 99, 0.12);
    --warning-color: #ff9800;
    --warning-light: #fff3e0;
}

.app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: linear-gradient(135deg, #faf9f6 0%, #f5f3ee 100%);
    font-family: "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: var(--text-primary);
}

.core-content {
    display: flex;
    flex: 1;
    height: 100%;
    overflow: hidden;
    position: relative;
}

/* === ✅ 侧边栏折叠切换按钮 === */
.sidebar-toggle {
    position: absolute;
    top: 50%;
    left: 280px;
    transform: translateY(-50%);
    width: 20px;
    height: 40px;
    background: var(--agri-gold);
    color: white;
    border-radius: 0 6px 6px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
    cursor: pointer;
    z-index: 10;
    box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.1);
    transition: left 0.3s ease, background 0.2s ease;
}

.sidebar-toggle:hover {
    background: #b88a12;
}

.sidebar-toggle.collapsed {
    left: 0;
    border-radius: 6px;
    width: 24px;
}

/* === 左侧会话栏 - 支持折叠 === */
.chat-sidebar {
    width: 280px;
    background: white;
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-sm);
    transition: width 0.3s ease;
}

.chat-sidebar.collapsed {
    width: 4px !important;
    overflow: hidden;
    cursor: pointer;
}

.chat-sidebar.collapsed:hover {
    width: 280px !important;
    box-shadow: var(--shadow-md);
    z-index: 20;
}

/* 折叠时隐藏内容，悬停恢复 */
.chat-sidebar.collapsed .sidebar-header,
.chat-sidebar.collapsed .conversation-list {
    opacity: 0;
    pointer-events: none;
}

.chat-sidebar.collapsed:hover .sidebar-header,
.chat-sidebar.collapsed:hover .conversation-list {
    opacity: 1;
    pointer-events: auto;
    transition: opacity 0.2s 0.1s ease;
}

.chat-sidebar.collapsed .conv-title,
.chat-sidebar.collapsed .conv-time,
.chat-sidebar.collapsed .delete-btn {
    display: none;
}

.chat-sidebar.collapsed:hover .conv-title,
.chat-sidebar.collapsed:hover .conv-time,
.chat-sidebar.collapsed:hover .delete-btn {
    display: block;
}

.sidebar-header {
    padding: 18px 16px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--agri-gold-light);
}

.sidebar-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--agri-brown);
    text-align: center;
    position: relative;
}

.sidebar-header h3::before {
    content: '🌾';
    margin-right: 8px;
}

.search-input {
    width: 100%;
}

.conversation-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    background: #faf9f6;
}

.conversation-item {
    position: relative;
    padding: 14px 16px 14px 50px;
    margin-bottom: 10px;
    border-radius: var(--border-radius-base);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: white;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
}

.conversation-item::before {
    content: '🌾';
    position: absolute;
    left: 18px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.2rem;
    color: var(--agri-green);
    opacity: 0.8;
}

.conversation-item:hover {
    background: var(--agri-green-light);
    border-color: var(--agri-green);
    transform: translateX(4px);
    box-shadow: var(--shadow-md);
}

.conversation-item.active {
    background: #e8f5e9;
    border-color: var(--agri-green);
    box-shadow: 0 4px 14px rgba(76, 175, 80, 0.2);
    transform: translateX(0);
}

.conv-title {
    font-size: 0.98rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.conv-time {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 4px;
}

/* ✅ 删除按钮：使用 🗑️ 图标 */
.delete-btn {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
    color: #f44336;
    background: transparent;
    border: none;
    padding: 4px;
    border-radius: 4px;
    font-size: 1rem;
}

.delete-btn::before {
    content: '🗑️';
}

.conversation-item:hover .delete-btn {
    opacity: 1;
}

.delete-btn:hover {
    background: rgba(244, 67, 54, 0.1);
    transform: translateY(-50%) scale(1.15);
}

.no-conversation {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
    font-size: 0.9rem;
    background: var(--agri-gold-light);
    border-radius: var(--border-radius-lg);
    margin: 12px;
    border: 1px dashed #c5a74e;
}

/* === 右侧聊天区 === */
.chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #faf9f6;
}

.chat-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 20px;
    color: var(--text-secondary);
}

.placeholder-icon {
    font-size: 5rem;
    color: var(--agri-green);
    text-shadow: 0 2px 6px rgba(76, 175, 80, 0.2);
}

.placeholder-text {
    font-size: 1.3rem;
    max-width: 450px;
    line-height: 1.6;
    font-weight: 600;
    color: var(--text-primary);
}

.page-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--text-primary);
}

.chat-container {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.chat-header {
    padding: 16px 24px;
    background: white;
    box-shadow: var(--shadow-sm);
    border-bottom: 1px solid var(--border-color);
}

.chat-title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--agri-brown);
    display: flex;
    align-items: center;
    gap: 10px;
}

.chat-title::before {
    content: '🌱';
    font-size: 1.3rem;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    scroll-behavior: smooth;
    background: #faf9f6;
    width: 100%; /* 确保占满父容器宽度 */
}

.message {
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    max-width: 100%; /* 从85%改为100%，去掉右侧空白 */
    animation: fadeIn 0.35s ease forwards;
}


@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.message-content {
    display: flex;
    gap: 12px;
}

.user-message {
    align-items: flex-end;
}

.user-message .message-content {
    flex-direction: row-reverse;
}

.avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #f5f3ee;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.06);
    flex-shrink: 0;
}

.user-message .avatar {
    background: linear-gradient(135deg, #4caf50, #81c784);
    color: white;
}

.assistant-message .avatar {
    background: #f5f3ee;
}

.text {
    padding: 16px;
    border-radius: var(--border-radius-lg);
    font-size: 0.96rem;
    line-height: 1.6;
    word-break: break-word;
    position: relative;
}

.user-message .text {
    background: linear-gradient(135deg, #4caf50, #81c784);
    color: white;
    border-top-right-radius: 6px;
    box-shadow: var(--shadow-md);
}

.assistant-message .text {
    background: white;
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 8px rgba(141, 110, 99, 0.08);
    border-top-left-radius: 6px;
}

.text::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
}

.user-message .text::after {
    bottom: -6px;
    right: 20px;
    border: 6px solid transparent;
    border-top-color: #4caf50;
}

.assistant-message .text::after {
    bottom: -6px;
    left: 20px;
    border: 6px solid transparent;
    border-top-color: white;
    box-shadow: -2px 2px 4px rgba(0, 0, 0, 0.03);
}

.msg-time {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 6px;
    text-align: right;
    opacity: 0.8;
}

.loading-text {
    color: var(--text-primary);
    margin-left: 8px;
}

.no-message {
    text-align: center;
    padding: 32px 24px;
    color: var(--text-secondary);
    font-size: 0.95rem;
    background: white;
    border-radius: var(--border-radius-lg);
    margin: 20px auto;
    max-width: 320px;
    border: 1px dashed var(--border-color);
}

.suggested-questions {
    padding: 20px 24px;
    background: white;
    border-top: 1px solid var(--border-color);
    border-bottom: 1px solid var(--border-color);
}

.suggested-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--agri-brown);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.suggested-title::before {
    content: '❓🌱';
}

.suggested-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.suggested-item {
    padding: 8px 18px;
    background: var(--agri-green-light);
    border-radius: 24px;
    font-size: 0.9rem;
    color: var(--agri-green);
    cursor: pointer;
    transition: all 0.25s ease;
    border: 1px solid transparent;
    font-weight: 500;
}

.suggested-item:hover {
    background: #c8e6c9;
    border-color: #a5d6a7;
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(76, 175, 80, 0.15);
}

.chat-input {
    padding: 16px 24px;
    background: white;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);
    display: flex;
    gap: 12px;
    align-items: flex-end;
}

.chat-input :deep(.el-textarea__inner) {
    border-radius: var(--border-radius-lg);
    border: 1px solid var(--border-color);
    padding: 14px 18px;
    font-size: 0.96rem;
    line-height: 1.5;
    transition: all 0.2s ease;
    background: #fefefe;
}

.chat-input :deep(.el-textarea__inner:hover),
.chat-input :deep(.el-textarea__inner:focus) {
    border-color: var(--agri-green);
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.25);
}

.chat-input :deep(.el-button) {
    border-radius: var(--border-radius-lg);
    padding: 12px 28px;
    height: auto;
    font-weight: 600;
    font-size: 0.96rem;
    background: linear-gradient(135deg, var(--agri-green), #66bb6a);
    border: none;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    color: white;
    transition: all 0.25s ease;
}

.chat-input :deep(.el-button:hover) {
    background: linear-gradient(135deg, #388e3c, #43a047);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
}

.chat-input :deep(.el-button:active) {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.25);
}

/* === ✅ 自定义删除确认弹窗 === */
.delete-confirm-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.delete-modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
}

.delete-modal-content {
    position: relative;
    background: #f5f0e5; /* 改为目标浅米色背景 */
    border-radius: var(--border-radius-lg);
    padding: 24px;
    width: 90%;
    max-width: 420px;
    box-shadow: var(--shadow-md); /* 保持和页面一致的阴影 */
    border: 1px solid var(--border-color); /* 匹配页面边框色 */
    z-index: 2001;
    animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: scale(0.9);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.delete-modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.delete-modal-icon {
    font-size: 1.8rem;
}

.delete-modal-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--agri-brown);
}

.delete-modal-body {
    margin-bottom: 20px;
}

.delete-modal-text {
    margin: 0 0 8px 0;
    font-size: 1rem;
    color: var(--text-primary);
    font-weight: 600;
}

.delete-modal-warning {
    margin: 0;
    font-size: 0.9rem;
    color: var(--warning-color);
    line-height: 1.5;
    padding: 8px 12px;
    background: var(--warning-light);
    border-radius: var(--border-radius-sm);
    border-left: 3px solid var(--warning-color);
}

.delete-modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.delete-modal-footer :deep(.el-button) {
    border-radius: var(--border-radius-base);
    padding: 10px 20px;
    font-weight: 500;
}

.cancel-btn {
    background: #f5f5f5;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
}

.cancel-btn:hover {
    background: #e0e0e0;
    color: var(--text-primary);
}

.confirm-btn {
    background: linear-gradient(135deg, #f44336, #ef5350);
    border: none;
    color: white;
}

.confirm-btn:hover {
    background: linear-gradient(135deg, #d32f2f, #e53935);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
}

/* 滚动条 */
::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-thumb {
    background: #cfd8dc;
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: #90a4ae;
}

/* 响应式 */
@media (max-width: 768px) {
    .chat-sidebar {
        width: 100%;
        max-height: 40%;
    }

    .core-content {
        flex-direction: column;
    }

    .message {
        max-width: 95%;
    }

    .chat-messages {
        padding: 12px;
    }

    /* 移动端隐藏 toggle 按钮 */
    .sidebar-toggle {
        display: none !important;
    }

    /* 移动端弹窗样式 */
    .delete-modal-content {
        width: 95%;
        margin: 0 20px;
        padding: 20px;
    }

    .delete-modal-title {
        font-size: 1.1rem;
    }

    .delete-modal-text {
        font-size: 0.95rem;
    }

    .delete-modal-warning {
        font-size: 0.85rem;
    }

    .delete-modal-footer {
        flex-direction: column;
    }

    .delete-modal-footer :deep(.el-button) {
        width: 100%;
    }
}

@media (max-width: 480px) {
    .sidebar-header h3 {
        font-size: 1.15rem;
    }

    .conv-title {
        font-size: 0.92rem;
    }

    .chat-title {
        font-size: 1.25rem;
    }

    .suggested-item {
        padding: 7px 14px;
        font-size: 0.88rem;
    }

    .avatar {
        width: 34px;
        height: 34px;
        font-size: 1rem;
    }
}
</style>