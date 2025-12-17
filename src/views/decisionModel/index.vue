<template>
  <div class="decision-model-container" style="display: flex; height: 100vh; background-color: #f0f8e6; color: #2e7d32;">
    <!-- 中间区域：预测记录 + 作物数据填写 -->
    <div class="middle-section" style="display: flex; flex: 1; overflow: hidden;">
      <!-- 预测记录面板 -->
      <div class="record-panel" style="width: 220px; background-color: #e8f5e9; padding: 15px; border-right: 1px solid #b6d7a8; overflow-y: auto;">
        <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div style="display: flex; align-items: center;">
            <span style="font-size: 16px; margin-right: 5px;">📋</span>
            <h3 style="margin: 0; font-size: 18px;">预测记录</h3>
          </div>
          <span style="font-size: 16px; cursor: pointer;" @click="toggleRecordPanel">^</span>
        </div>
        <div style="font-size: 14px; margin-bottom: 10px; font-weight: 500;">本月</div>
        <div class="record-list">
          <div class="record-item" style="font-size: 12px; color: #666; margin-bottom: 8px; display: flex; justify-content: space-between;" v-for="(record, idx) in recordList" :key="idx">
            <span>{{ record.time }}</span>
            <span style="cursor: pointer;" @click="deleteRecord(idx)">×</span>
          </div>
        </div>
      </div>

      <!-- 作物数据填写面板 -->
      <div class="form-panel" style="flex: 1; background-color: #f0f8e6; padding: 20px; overflow-y: auto;">
        <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 20px;">作物数据填写</h3>
          <el-button type="success" icon="el-icon-plus" circle size="small" />
        </div>

        <!-- 表单区域 -->
        <el-form :model="form" :rules="rules" ref="formRef" label-width="80px" style="max-width: 500px;">
          <!-- 决策类型 -->
          <el-form-item label="决策类型" prop="decisionType">
            <el-select v-model="form.decisionType" style="width: 100%;">
              <el-option label="请选择决策类型" value="" />
              <el-option label="长期决策" value="long" />
              <el-option label="短期决策" value="short" />
            </el-select>
            <el-tooltip content="选择决策的时间范围" placement="right">
              <span style="margin-left: 5px; color: #4caf50;">ⓘ</span>
            </el-tooltip>
          </el-form-item>

          <!-- 作物种类 + 作物品种：联动下拉 -->
          <el-form-item label="作物种类" prop="cropType">
            <el-select 
              v-model="form.cropType" 
              style="width: 48%; margin-right: 4%;"
              @change="handleCropTypeChange"
            >
              <el-option label="请选择作物种类" value="" />
              <el-option label="大豆" value="soybean" />
              <el-option label="小麦" value="wheat" />
              <el-option label="玉米" value="corn" />
              <el-option label="稻米" value="rice" />
            </el-select>
            <el-select v-model="form.cropSubType" style="width: 48%;" prop="cropSubType">
              <el-option label="请选择作物品种" value="" />
              <el-option 
                v-for="(item, idx) in currentCropSubTypes" 
                :key="idx" 
                :label="item" 
                :value="item" 
              />
            </el-select>
            <el-tooltip content="选择作物的品类" placement="right">
              <span style="margin-left: 5px; color: #4caf50;">ⓘ</span>
            </el-tooltip>
          </el-form-item>

          <!-- 种植地点：省市级联下拉（核心修改） -->
          <el-form-item label="种植地点" prop="plantLocation">
            <el-select 
              v-model="selectedProvince" 
              style="width: 48%; margin-right: 4%;"
              @change="loadCities"
              placeholder="请选择省份"
            >
              <el-option 
                v-for="province in provinces" 
                :key="province" 
                :label="province" 
                :value="province" 
              />
            </el-select>
            <el-select 
              v-model="selectedCity" 
              style="width: 48%;"
              @change="() => { form.plantLocation = `${selectedProvince}/${selectedCity}` }"
              placeholder="请选择城市"
              :disabled="!selectedProvince"
            >
              <el-option 
                v-for="city in cities" 
                :key="city" 
                :label="city" 
                :value="city" 
              />
            </el-select>
            <el-tooltip content="选择作物的种植区域" placement="right">
              <span style="margin-left: 5px; color: #4caf50;">ⓘ</span>
            </el-tooltip>
          </el-form-item>

          <!-- 经纬度 -->
          <el-form-item label="经纬度" prop="latitude">
            <el-input v-model="form.latitude" style="width: 48%; margin-right: 4%;" placeholder="请输入纬度" />
            <el-input v-model="form.longitude" style="width: 48%;" placeholder="请输入经度" />
            <el-tooltip content="填写种植区域的经纬度" placement="right">
              <span style="margin-left: 5px; color: #4caf50;">ⓘ</span>
            </el-tooltip>
          </el-form-item>

          <!-- 播种时间（双重限制：不支持10月~2月 + 不支持未来时间） -->
          <el-form-item label="播种时间" prop="sowDate">
            <el-date-picker 
              v-model="form.sowDate" 
              type="date" 
              style="width: 100%;" 
              placeholder="开始播种时间，不支持10月~2月及未来时间"
              :disabled-date="disabledSowDate"
            />
            <el-tooltip content="选择作物的播种日期（不支持10月至次年2月，且不能选择未来时间）" placement="right">
              <span style="margin-left: 5px; color: #4caf50;">ⓘ</span>
            </el-tooltip>
          </el-form-item>

          <!-- 决策时间（核心修改：不支持未来时间） -->
          <el-form-item label="决策时间" prop="decisionDate">
            <el-date-picker 
              v-model="form.decisionDate" 
              type="date" 
              style="width: 100%;" 
              placeholder="请选择决策时间，不支持未来时间"
              :disabled-date="disabledFutureDate" 
            />
            <el-tooltip content="选择决策的日期（不能选择未来时间）" placement="right">
              <span style="margin-left: 5px; color: #4caf50;">ⓘ</span>
            </el-tooltip>
          </el-form-item>

          <!-- 农事记录 -->
          <el-form-item label="农事记录" prop="farmOperations">
            <el-checkbox-group v-model="form.farmOperations" style="display: flex; flex-wrap: wrap; gap: 10px;">
              <el-checkbox label="浇水" />
              <el-checkbox label="施肥" />
              <el-checkbox label="除虫" />
              <el-checkbox label="除草" />
              <el-checkbox label="排水" />
            </el-checkbox-group>
            <el-tooltip content="选择已进行的农事操作" placement="right">
              <span style="margin-left: 5px; color: #4caf50;">ⓘ</span>
            </el-tooltip>
          </el-form-item>

          <!-- 提交按钮 -->
          <el-form-item>
            <el-button type="success" @click="submitForm" :loading="isSubmitting">
              <i class="el-icon-loading" v-if="isSubmitting"></i>
              提交数据，生成问题
            </el-button>
            <el-button type="info" @click="resetForm" style="margin-left: 10px;">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- 右侧模型响应面板 -->
    <div class="response-panel" style="width: 400px; background-color: #e8f5e9; padding: 20px; border-left: 1px solid #b6d7a8; overflow-y: auto;">
      <div style="font-size: 14px; margin-bottom: 15px;">
        状态：
        <span style="color: #2e7d32; font-weight: 500;">{{ modelStatus }}</span>
      </div>
      
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #fff; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
          <span style="font-size: 20px; color: #2e7d32;">🌱</span>
        </div>
      </div>

      <div style="font-weight: 500; margin-bottom: 10px;">整合后的问题：</div>

      <!-- 整合后的问题展示 -->
      <div style="background-color: #fff; padding: 15px; border-radius: 8px; min-height: 300px; white-space: pre-line; overflow-y: auto;">
        <div style="font-size: 14px; line-height: 1.8; color: #333;">
          {{ integratedQuestion || "请填写完整表单并提交，生成整合后的问题" }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 导入 Element Plus 组件和样式
import { ElMessage } from 'element-plus';
import 'element-plus/dist/index.css';
import { 
  ElForm, ElFormItem, ElSelect, ElOption, ElInput, ElDatePicker, 
  ElCheckbox, ElCheckboxGroup, ElButton, ElTooltip 
} from 'element-plus';

import { ref, reactive, onMounted } from 'vue';
import axios from 'axios'; // 导入axios（若项目已封装，可替换为你的request实例）

// 1. 定义作物-品种的映射关系
const cropSubTypeMap = {
  soybean: [
    "大豆901号", "大豆902号", "大豆903号", "大豆904号", "大豆905号", "大豆906号", "大豆西姆斯特-1988"
  ],
  wheat: ["春小麦"],
  corn: ["玉米201号", "玉米202号", "玉米203号", "玉米204号", "玉米205号"],
  rice: [
    "稻米-HYV-IR8", "稻米-IR8A", "稻米-IR64", "稻米-IR72-DS", "稻米-IR72-WS", 
    "稻米-IR64616H-DS", "稻米-IR64616H-WS"
  ],
  default: []
};

// 2. 表单相关配置
const formRef = ref<any>(null);
const form = reactive({
  decisionType: '',
  cropType: '',
  cropSubType: '',
  plantLocation: '', // 存储格式："省份/城市"
  latitude: '',
  longitude: '',
  sowDate: '' as Date | string,
  decisionDate: '' as Date | string,
  farmOperations: [] as string[],
});

const currentCropSubTypes = ref<string[]>([]);

// 3. 省市相关响应式数据（核心新增）
const provinces = ref<string[]>([]); // 所有省份列表
const cities = ref<string[]>([]);   // 选中省份的城市列表
const selectedProvince = ref('');  // 当前选中的省份
const selectedCity = ref('');      // 当前选中的城市

// 状态管理
const isSubmitting = ref(false);
const modelStatus = ref('未提交');
const integratedQuestion = ref(''); // 存储整合后的问题
const recordList = ref([
  { time: '2025年11月21日 18时01分00秒' },
  { time: '2025年11月21日 17时56分37秒' },
]);

// 通用方法：禁用未来时间
const disabledFutureDate = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
};

// 播种时间禁用逻辑
const disabledSowDate = (date: Date) => {
  const month = date.getMonth() + 1;
  return (month >= 10 || month <= 2) || disabledFutureDate(date);
};

// 表单校验规则（修改plantLocation校验）
const rules = reactive({
  decisionType: [{ required: true, message: '请选择决策类型', trigger: 'change' }],
  cropType: [{ required: true, message: '请选择作物种类', trigger: 'change' }],
  cropSubType: [{ required: true, message: '请选择作物品种', trigger: 'change' }],
  plantLocation: [{ required: true, message: '请选择省份和城市', trigger: 'change' }], // 修改校验提示
  latitude: [{ required: true, message: '请填写纬度', trigger: 'blur' }],
  longitude: [{ required: true, message: '请填写经度', trigger: 'blur' }],
  sowDate: [
    { required: true, message: '请选择播种时间', trigger: 'change' },
    {
      validator: (rule, value, callback) => {
        if (!value) return callback();
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          callback(new Error('请输入合法的日期'));
          return;
        }
        const month = date.getMonth() + 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date > today) {
          callback(new Error('播种时间不能选择未来时间，请选择当前及之前的日期'));
          return;
        }
        if (month >= 10 || month <= 2) {
          callback(new Error('播种时间不支持10月到2月，请选择3-9月的日期'));
          return;
        }
        callback();
      },
      trigger: ['change', 'blur']
    }
  ],
  decisionDate: [
    { required: true, message: '请选择决策时间', trigger: 'change' },
    {
      validator: (rule, value, callback) => {
        if (!value) return callback();
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          callback(new Error('请输入合法的日期'));
          return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date > today) {
          callback(new Error('决策时间不能选择未来时间，请选择当前及之前的日期'));
        } else {
          callback();
        }
      },
      trigger: ['change', 'blur']
    }
  ],
  farmOperations: [{ required: true, message: '请至少选择一项农事操作', trigger: 'change' }],
});

// 监听作物种类变化
const handleCropTypeChange = (val: string) => {
  form.cropSubType = '';
  currentCropSubTypes.value = cropSubTypeMap[val as keyof typeof cropSubTypeMap] || cropSubTypeMap.default;
};

// 4. 省市相关请求方法（核心新增）
// 获取所有省份
const loadProvinces = async () => {
  try {
    const res = await axios.get('/api/area/provinces'); // 调用后端省份接口
    provinces.value = res.data.data; // 适配后端Result响应格式（data字段存数据）
  } catch (err) {
    ElMessage.error('加载省份失败，请检查后端服务');
    console.error('省份加载失败：', err);
  }
};

// 根据选中的省份加载城市
const loadCities = async () => {
  if (!selectedProvince.value) {
    cities.value = [];
    selectedCity.value = '';
    form.plantLocation = ''; // 清空种植地点
    return;
  }
  try {
    const res = await axios.get('/api/area/cities', {
      params: { provinceName: selectedProvince.value } // 传递省份名称参数
    });
    cities.value = res.data.data; // 适配后端Result响应格式
  } catch (err) {
    ElMessage.error('加载城市失败');
    console.error('城市加载失败：', err);
  }
};

// 页面挂载时加载省份（核心新增）
onMounted(() => {
  loadProvinces(); // 初始化省份数据
});

// 提交表单（修改种植地点拼接逻辑）
const submitForm = async () => {
  try {
    await formRef.value.validate();
    isSubmitting.value = true;
    modelStatus.value = '生成中...';

    // 格式化日期（统一为字符串格式）
    const formattedSowDate = form.sowDate instanceof Date 
      ? form.sowDate.toLocaleDateString('zh-CN') 
      : new Date(form.sowDate).toLocaleDateString('zh-CN');
    
    const formattedDecisionDate = form.decisionDate instanceof Date 
      ? form.decisionDate.toLocaleDateString('zh-CN') 
      : new Date(form.decisionDate).toLocaleDateString('zh-CN');

    // 作物种类中文映射
    const cropTypeCN = form.cropType === 'soybean' ? '大豆' : 
                      form.cropType === 'wheat' ? '小麦' : 
                      form.cropType === 'corn' ? '玉米' : '稻米';

    // 种植地点中文映射（核心修改：动态拼接选中的省和市）
    const locationCN = form.plantLocation.replace('/', ''); // 格式："河北省秦皇岛市"

    // 决策类型中文映射
    const decisionTypeCN = form.decisionType === 'long' ? '长期' : '短期';

    // 整合表单条件为自然语言问题
    integratedQuestion.value = `我需要进行${decisionTypeCN}决策，种植的作物种类是${cropTypeCN}，具体品种为${form.cropSubType}，种植地点位于${locationCN}，经纬度坐标为纬度${form.latitude}、经度${form.longitude}。该作物的播种时间为${formattedSowDate}，计划决策时间为${formattedDecisionDate}。目前已完成的农事操作包括${form.farmOperations.join('、')}。请结合以上信息，分析该作物当前的生长阶段状态，并给出对应的后续农事管理建议。`;

    // 添加预测记录
    const now = new Date();
    const timeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}时${now.getMinutes().toString().padStart(2, '0')}分${now.getSeconds().toString().padStart(2, '0')}秒`;
    recordList.value.unshift({ time: timeStr });

    modelStatus.value = '已生成';
    ElMessage.success('问题生成成功！');
    isSubmitting.value = false;
  } catch (error: any) {
    ElMessage.error(`操作失败：${error.message || '表单填写有误'}`);
    modelStatus.value = '生成失败';
    isSubmitting.value = false;
  }
};

// 辅助方法（修改重置逻辑：清空省市选择）
const resetForm = () => {
  formRef.value.resetFields();
  modelStatus.value = '未提交';
  integratedQuestion.value = '';
  currentCropSubTypes.value = [];
  // 清空省市选择（核心新增）
  selectedProvince.value = '';
  selectedCity.value = '';
  cities.value = [];
};

const deleteRecord = (idx: number) => {
  recordList.value.splice(idx, 1);
  ElMessage.success('记录已删除');
};

const toggleRecordPanel = () => {
  const panel = document.querySelector('.record-panel') as HTMLDivElement;
  panel.style.width = panel.style.width === '220px' ? '0' : '220px';
  panel.style.padding = panel.style.width === '220px' ? '15px' : '0';
};
</script>

<style scoped>
/* 滚动条美化 */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-thumb {
  background: #b6d7a8;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #81c784;
}

/* 响应面板样式优化 */
.response-panel div[style*="white-space: pre-line"] {
  word-break: break-all;
}
</style>