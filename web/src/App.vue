<template>
  <div class="h-full w-full flex flex-col bg-[#FEF7FF] text-[#1D1B20] overflow-hidden select-none font-sans">
    <!-- Top Bar -->
    <TopBar @open-sort="isSortSelectorOpen = true" />

    <!-- Search / Filter Bar (compact filter if items exist) -->
    <div v-if="store.activeListItems.length > 5" class="px-4 py-2 bg-[#F3F0F7] border-b border-[#E6E0E9]">
      <div class="max-w-4xl mx-auto relative">
        <input
          v-model="store.searchQuery"
          type="text"
          placeholder="Search items..."
          class="w-full bg-white border border-[#CAC4D0] rounded-xl pl-9 pr-8 py-2 text-base sm:text-xs font-semibold text-[#1D1B20] placeholder-[#79747E] focus:outline-none focus:border-[#6750A4] shadow-sm"
        />
        <svg class="w-4 h-4 text-[#49454F] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <button
          v-if="store.searchQuery"
          @click="store.searchQuery = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-[#49454F] hover:text-[#1D1B20] font-bold text-xs"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Main Items Scroll Container -->
    <main class="flex-1 overflow-y-auto px-3 sm:px-4 py-3 overscroll-contain bg-[#FEF7FF]">
      <div class="max-w-4xl mx-auto min-h-full flex flex-col justify-between">
        <!-- Item List -->
        <div v-if="store.sortedItems.length > 0" class="space-y-1.5">
          <ItemRow
            v-for="item in store.sortedItems"
            :key="item.id"
            :item="item"
            :is-custom-sort="store.sortMode === 'custom'"
            @update-status="(status) => handleUpdateStatus(item.id, status)"
            @update-text="(text) => handleUpdateText(item.id, text)"
            @update-item="(payload) => handleUpdateItem(item.id, payload)"
            @move="(dir) => handleMoveItem(item.id, dir)"
          />
        </div>

        <!-- Empty State -->
        <div
          v-else
          class="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto"
        >
          <div class="w-16 h-16 rounded-2xl bg-[#E8DEF8] text-[#21005D] flex items-center justify-center mb-4 shadow-sm">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 class="text-base font-extrabold uppercase tracking-tight text-[#1D1B20] mb-1">
            {{ store.searchQuery ? 'No matching items' : 'List is empty' }}
          </h3>
          <p class="text-xs font-medium text-[#49454F] max-w-xs mb-5">
            {{ store.searchQuery ? 'Try clearing your search query.' : 'Type below to add an item, or tap Import to paste a batch of items.' }}
          </p>
          <button
            v-if="!store.searchQuery"
            @click="store.isImportModalOpen = true"
            class="px-5 py-2.5 bg-[#E8DEF8] hover:bg-[#D6C7EE] text-[#21005D] rounded-2xl text-xs font-bold uppercase tracking-wider border border-[#CAC4D0] transition-colors shadow-sm"
          >
            Import Multiple Items
          </button>
        </div>

        <!-- Quick footer info for active list -->
        <div v-if="store.sortedItems.length > 0" class="pt-4 pb-2 text-center text-xs font-bold uppercase tracking-wider text-[#49454F]">
          {{ completedCount }} / {{ totalActiveCount }} completed
          <span v-if="store.showDeleted && deletedCount > 0"> ({{ deletedCount }} deleted)</span>
        </div>
      </div>
    </main>

    <!-- Bottom Add Item Input Bar -->
    <AddItemInput @add="handleAddItem" />

    <!-- Modals & Drawers -->
    <Sidebar @request-confirm="openConfirmModal" />
    <SortSelector v-if="isSortSelectorOpen" @close="isSortSelectorOpen = false" />
    <ImportModal v-if="store.isImportModalOpen" />
    <SettingsModal v-if="store.isSettingsModalOpen" @request-confirm="openConfirmModal" />
    <SetupPhraseModal v-if="store.isSetupModalOpen" />

    <ConfirmModal
      :is-open="confirmDialog.isOpen"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-text="confirmDialog.confirmText"
      :type="confirmDialog.type"
      @confirm="handleConfirmAction"
      @cancel="confirmDialog.isOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useListStore } from './stores/listStore.js';
import TopBar from './components/TopBar.vue';
import Sidebar from './components/Sidebar.vue';
import ItemRow from './components/ItemRow.vue';
import AddItemInput from './components/AddItemInput.vue';
import SortSelector from './components/SortSelector.vue';
import ImportModal from './components/ImportModal.vue';
import SettingsModal from './components/SettingsModal.vue';
import SetupPhraseModal from './components/SetupPhraseModal.vue';
import ConfirmModal from './components/ConfirmModal.vue';

const store = useListStore();

const isSortSelectorOpen = ref(false);

const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  type: 'danger',
  action: null
});

function openConfirmModal(config) {
  confirmDialog.value = {
    isOpen: true,
    title: config.title || 'Are you sure?',
    message: config.message || '',
    confirmText: config.confirmText || 'Confirm',
    type: config.confirmType || 'danger',
    action: config.action || null
  };
}

function handleConfirmAction() {
  if (typeof confirmDialog.value.action === 'function') {
    confirmDialog.value.action();
  }
  confirmDialog.value.isOpen = false;
}

const completedCount = computed(() => {
  const list = store.activeList;
  if (!list || !Array.isArray(list.items)) return 0;
  return list.items.filter(i => i.status === 'completed').length;
});

const totalActiveCount = computed(() => {
  const list = store.activeList;
  if (!list || !Array.isArray(list.items)) return 0;
  return list.items.filter(i => i.status !== 'deleted').length;
});

const deletedCount = computed(() => {
  const list = store.activeList;
  if (!list || !Array.isArray(list.items)) return 0;
  return list.items.filter(i => i.status === 'deleted').length;
});

function handleAddItem(text) {
  if (store.activeList) {
    store.addItem(store.activeList.id, text);
  }
}

function handleUpdateStatus(itemId, newStatus) {
  if (store.activeList) {
    store.updateItemStatus(store.activeList.id, itemId, newStatus);
  }
}

function handleUpdateText(itemId, newText) {
  if (store.activeList) {
    store.updateItemText(store.activeList.id, itemId, newText);
  }
}

function handleUpdateItem(itemId, { text, details }) {
  if (store.activeList) {
    store.updateItem(store.activeList.id, itemId, { text, details });
  }
}

function handleMoveItem(itemId, direction) {
  if (store.activeList) {
    store.moveItemPosition(store.activeList.id, itemId, direction);
  }
}

onMounted(() => {
  store.initApp();

  // Listen for back press dispatched from Android
  window.addEventListener('android-back', () => {
    if (confirmDialog.value.isOpen) {
      confirmDialog.value.isOpen = false;
    } else if (isSortSelectorOpen.value) {
      isSortSelectorOpen.value = false;
    } else if (store.isImportModalOpen) {
      store.isImportModalOpen = false;
    } else if (store.isSettingsModalOpen) {
      store.isSettingsModalOpen = false;
    } else if (store.isSidebarOpen) {
      store.isSidebarOpen = false;
    }
  });
});
</script>
