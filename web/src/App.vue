<template>
  <div class="h-full w-full flex flex-col bg-[#FEF7FF] text-[#1D1B20] overflow-hidden select-none font-sans">
    <!-- Top Bar -->
    <TopBar
      @open-sort="isSortSelectorOpen = true"
      @create-folder="openCreateFolderModal"
    />

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
        <!-- Section / Folder Grouped View -->
        <div v-if="store.activeListFolders.length > 0" class="space-y-4">
          <div
            v-for="group in store.groupedItems"
            :key="group.folder ? group.folder.id : 'unassigned'"
            class="space-y-2"
          >
            <!-- Folder Header Card -->
            <div
              v-if="group.folder"
              class="flex items-center justify-between px-3.5 py-2.5 bg-[#F3F0F7] border border-[#CAC4D0] rounded-2xl shadow-sm transition-all"
            >
              <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                <button
                  type="button"
                  @click="store.toggleFolderCollapse(store.activeList.id, group.folder.id)"
                  class="p-1 text-[#49454F] hover:text-[#1D1B20] transition-transform duration-200"
                  :class="{ '-rotate-90': group.folder.isCollapsed }"
                  title="Toggle collapse"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  @click="openRenameFolderModal(group.folder)"
                  class="flex items-center space-x-2 min-w-0 cursor-pointer group/title"
                  title="Click to rename folder"
                >
                  <span class="text-sm font-extrabold uppercase tracking-tight text-[#1D1B20] truncate group-hover/title:text-[#6750A4] transition-colors">
                    📁 {{ group.folder.name }}
                  </span>
                  <svg class="w-3.5 h-3.5 text-[#79747E] opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>

                <span class="px-2 py-0.5 rounded-full bg-[#E8DEF8] text-[#21005D] text-[10px] font-bold shrink-0">
                  {{ getFolderStats(group.items) }}
                </span>
              </div>

              <!-- Folder Actions -->
              <div class="flex items-center space-x-1 shrink-0">
                <!-- Quick Add To This Folder -->
                <button
                  type="button"
                  @click="triggerAddForFolder(group.folder.id)"
                  class="p-1.5 rounded-xl text-[#49454F] hover:text-[#6750A4] hover:bg-white transition-colors"
                  title="Add item to this folder"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <!-- Rename Folder -->
                <button
                  type="button"
                  @click="openRenameFolderModal(group.folder)"
                  class="p-1.5 rounded-xl text-[#49454F] hover:text-[#1D1B20] hover:bg-white transition-colors"
                  title="Rename folder"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>

                <!-- Move Folder Position (custom sort) -->
                <button
                  v-if="store.sortMode === 'custom' && store.activeListFolders.length > 1"
                  type="button"
                  @click="store.moveFolderPosition(store.activeList.id, group.folder.id, 'up')"
                  class="p-1 text-[#49454F] hover:text-[#6750A4] hover:bg-white rounded-lg transition-colors"
                  title="Move folder up"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  v-if="store.sortMode === 'custom' && store.activeListFolders.length > 1"
                  type="button"
                  @click="store.moveFolderPosition(store.activeList.id, group.folder.id, 'down')"
                  class="p-1 text-[#49454F] hover:text-[#6750A4] hover:bg-white rounded-lg transition-colors"
                  title="Move folder down"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <!-- Delete Folder -->
                <button
                  type="button"
                  @click="confirmDeleteFolder(group.folder)"
                  class="p-1.5 rounded-xl text-[#49454F] hover:text-red-600 hover:bg-white transition-colors"
                  title="Delete folder"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Unassigned / General Header Card -->
            <div
              v-else-if="group.items.length > 0"
              class="flex items-center justify-between px-3.5 py-2.5 bg-[#F3F0F7]/70 border border-[#CAC4D0]/70 rounded-2xl shadow-sm transition-all"
            >
              <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                <button
                  type="button"
                  @click="isGeneralCollapsed = !isGeneralCollapsed"
                  class="p-1 text-[#49454F] hover:text-[#1D1B20] transition-transform duration-200"
                  :class="{ '-rotate-90': isGeneralCollapsed }"
                  title="Toggle collapse"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <span class="text-sm font-extrabold uppercase tracking-tight text-[#49454F] truncate">
                  📁 General / Unassigned
                </span>

                <span class="px-2 py-0.5 rounded-full bg-[#E8DEF8] text-[#21005D] text-[10px] font-bold shrink-0">
                  {{ getFolderStats(group.items) }}
                </span>
              </div>

              <!-- Quick Add to General -->
              <button
                type="button"
                @click="triggerAddForFolder(null)"
                class="p-1.5 rounded-xl text-[#49454F] hover:text-[#6750A4] hover:bg-white transition-colors"
                title="Add item to General"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <!-- Items inside Group -->
            <div
              v-if="(group.folder ? !group.folder.isCollapsed : !isGeneralCollapsed)"
              class="space-y-1.5 pl-1.5 sm:pl-3"
            >
              <div v-if="group.items.length > 0" class="space-y-1.5">
                <ItemRow
                  v-for="item in group.items"
                  :key="item.id"
                  :item="item"
                  :folders="store.activeListFolders"
                  :is-custom-sort="store.sortMode === 'custom'"
                  @update-status="(status) => handleUpdateStatus(item.id, status)"
                  @update-text="(text) => handleUpdateText(item.id, text)"
                  @update-item="(payload) => handleUpdateItem(item.id, payload)"
                  @move="(dir) => handleMoveItem(item.id, dir)"
                />
              </div>
              <div
                v-else
                class="py-3 px-4 text-center text-xs font-semibold text-[#79747E] bg-white/50 rounded-2xl border border-dashed border-[#CAC4D0]"
              >
                No items in this folder yet.
                <button
                  type="button"
                  @click="triggerAddForFolder(group.folder ? group.folder.id : null)"
                  class="ml-1.5 text-[#6750A4] font-bold hover:underline"
                >
                  + Add Item
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Add Folder Button -->
          <div class="pt-2 flex justify-center">
            <button
              type="button"
              @click="openCreateFolderModal"
              class="px-4 py-2 bg-white hover:bg-[#E8DEF8] text-[#21005D] rounded-2xl text-xs font-bold uppercase tracking-wider border border-[#CAC4D0] transition-colors shadow-sm flex items-center space-x-1.5"
            >
              <svg class="w-4 h-4 text-[#6750A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <span>+ New Folder / Section</span>
            </button>
          </div>
        </div>

        <!-- Flat View (When list has no folders yet) -->
        <div v-else-if="store.sortedItems.length > 0" class="space-y-1.5">
          <ItemRow
            v-for="item in store.sortedItems"
            :key="item.id"
            :item="item"
            :folders="store.activeListFolders"
            :is-custom-sort="store.sortMode === 'custom'"
            @update-status="(status) => handleUpdateStatus(item.id, status)"
            @update-text="(text) => handleUpdateText(item.id, text)"
            @update-item="(payload) => handleUpdateItem(item.id, payload)"
            @move="(dir) => handleMoveItem(item.id, dir)"
          />

          <!-- Convert / Add First Folder Prompt -->
          <div class="pt-4 flex justify-center">
            <button
              type="button"
              @click="openCreateFolderModal"
              class="px-3.5 py-1.5 bg-white/80 hover:bg-[#E8DEF8] text-[#49454F] hover:text-[#21005D] rounded-2xl text-[11px] font-bold uppercase tracking-wider border border-[#CAC4D0] transition-colors shadow-sm flex items-center space-x-1.5"
            >
              <svg class="w-3.5 h-3.5 text-[#6750A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <span>Organize with Folders</span>
            </button>
          </div>
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
          <div class="flex items-center space-x-2">
            <button
              v-if="!store.searchQuery"
              @click="store.isImportModalOpen = true"
              class="px-5 py-2.5 bg-[#E8DEF8] hover:bg-[#D6C7EE] text-[#21005D] rounded-2xl text-xs font-bold uppercase tracking-wider border border-[#CAC4D0] transition-colors shadow-sm"
            >
              Import Multiple Items
            </button>
            <button
              v-if="!store.searchQuery"
              @click="openCreateFolderModal"
              class="px-4 py-2.5 bg-white hover:bg-[#F3F0F7] text-[#1D1B20] rounded-2xl text-xs font-bold uppercase tracking-wider border border-[#CAC4D0] transition-colors shadow-sm"
            >
              + Add Folder
            </button>
          </div>
        </div>

        <!-- Quick footer info for active list -->
        <div v-if="store.sortedItems.length > 0" class="pt-4 pb-2 text-center text-xs font-bold uppercase tracking-wider text-[#49454F]">
          {{ completedCount }} / {{ totalActiveCount }} completed
          <span v-if="store.showDeleted && deletedCount > 0"> ({{ deletedCount }} deleted)</span>
        </div>
      </div>
    </main>

    <!-- Bottom Add Item Input Bar -->
    <AddItemInput
      ref="addItemInputRef"
      :folders="store.activeListFolders"
      :model-value-target-folder="store.activeTargetFolderId"
      @update:target-folder="(id) => store.setActiveTargetFolder(id)"
      @add="handleAddItem"
    />

    <!-- New/Rename Folder Modal -->
    <div
      v-if="isFolderModalOpen"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
    >
      <div class="w-full max-w-sm bg-[#FEF7FF] border border-[#CAC4D0] rounded-3xl shadow-2xl p-5 overflow-hidden">
        <div class="flex items-center space-x-2.5 mb-4 pb-2 border-b border-[#E6E0E9]">
          <div class="w-8 h-8 rounded-xl bg-[#E8DEF8] text-[#21005D] flex items-center justify-center font-bold">
            📁
          </div>
          <h3 class="text-base font-extrabold uppercase tracking-tight text-[#1D1B20]">
            {{ folderModalMode === 'create' ? 'New Folder / Section' : 'Rename Folder' }}
          </h3>
        </div>

        <form @submit.prevent="handleSaveFolderModal" class="space-y-4">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-[#49454F] mb-1">
              Folder Name
            </label>
            <input
              ref="folderModalInput"
              v-model="folderModalName"
              type="text"
              placeholder="e.g. Produce, Backlog, Dairy..."
              class="w-full bg-white border-2 border-[#6750A4] rounded-xl px-3 py-2 text-sm font-semibold text-[#1D1B20] focus:outline-none shadow-sm transition-all"
              @keydown.esc="isFolderModalOpen = false"
            />
          </div>

          <div class="flex items-center justify-end space-x-2 pt-2 border-t border-[#E6E0E9]">
            <button
              type="button"
              @click="isFolderModalOpen = false"
              class="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7] rounded-xl transition-colors active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="!folderModalName.trim()"
              class="px-5 py-2 bg-[#6750A4] hover:bg-[#533f86] active:scale-95 disabled:opacity-40 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
            >
              {{ folderModalMode === 'create' ? 'Create' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>

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

    <!-- Dynamic OTA Update Banner -->
    <transition name="fade">
      <div
        v-if="updateAvailable"
        class="fixed bottom-20 left-4 right-4 z-40 max-w-sm mx-auto bg-[#21005D] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between border border-[#6750A4]"
      >
        <div class="flex items-center space-x-2 text-xs font-bold tracking-wide">
          <span>✨ New update installed!</span>
        </div>
        <button
          @click="applyUpdate"
          class="px-3.5 py-1.5 bg-white text-[#21005D] rounded-xl text-xs font-extrabold uppercase tracking-wider hover:bg-[#E8DEF8] transition-colors shadow-sm"
        >
          Reload
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue';
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

const addItemInputRef = ref(null);
const isSortSelectorOpen = ref(false);
const updateAvailable = ref(false);
const isGeneralCollapsed = ref(false);

// Folder Modal state
const isFolderModalOpen = ref(false);
const folderModalMode = ref('create'); // 'create' | 'rename'
const folderModalName = ref('');
const editingFolderId = ref(null);
const folderModalInput = ref(null);

function openCreateFolderModal() {
  folderModalMode.value = 'create';
  folderModalName.value = '';
  editingFolderId.value = null;
  isFolderModalOpen.value = true;
  nextTick(() => {
    if (folderModalInput.value) {
      folderModalInput.value.focus();
    }
  });
}

function openRenameFolderModal(folder) {
  folderModalMode.value = 'rename';
  folderModalName.value = folder.name;
  editingFolderId.value = folder.id;
  isFolderModalOpen.value = true;
  nextTick(() => {
    if (folderModalInput.value) {
      folderModalInput.value.focus();
      folderModalInput.value.select();
    }
  });
}

function handleSaveFolderModal() {
  const trimmed = folderModalName.value.trim();
  if (!trimmed || !store.activeList) return;

  if (folderModalMode.value === 'create') {
    store.createFolder(store.activeList.id, trimmed);
  } else if (folderModalMode.value === 'rename' && editingFolderId.value) {
    store.renameFolder(store.activeList.id, editingFolderId.value, trimmed);
  }
  isFolderModalOpen.value = false;
}

function confirmDeleteFolder(folder) {
  openConfirmModal({
    title: `Delete Folder "${folder.name}"?`,
    message: 'Items inside this folder will remain in your list and be moved to General (Unsorted).',
    confirmText: 'Delete Folder',
    confirmType: 'danger',
    action: () => {
      if (store.activeList) {
        store.deleteFolder(store.activeList.id, folder.id, false);
      }
    }
  });
}

function getFolderStats(items) {
  if (!items || items.length === 0) return '0 items';
  const completed = items.filter(i => i.status === 'completed').length;
  const active = items.filter(i => i.status !== 'deleted').length;
  return `${completed}/${active}`;
}

function triggerAddForFolder(folderId) {
  store.setActiveTargetFolder(folderId);
  if (addItemInputRef.value) {
    addItemInputRef.value.focusInput(folderId);
  }
}

function applyUpdate() {
  window.location.reload();
}

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

function handleAddItem(payload) {
  if (!store.activeList) return;
  if (typeof payload === 'string') {
    store.addItem(store.activeList.id, payload);
  } else if (payload && payload.text) {
    store.addItem(store.activeList.id, payload.text, payload.folderId);
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

function handleUpdateItem(itemId, { text, details, folderId }) {
  if (store.activeList) {
    store.updateItem(store.activeList.id, itemId, { text, details, folderId });
  }
}

function handleMoveItem(itemId, direction) {
  if (store.activeList) {
    store.moveItemPosition(store.activeList.id, itemId, direction);
  }
}

onMounted(() => {
  store.initApp();

  // Listen for OTA update notifications from Android
  window.addEventListener('web-update-ready', (e) => {
    console.log('Web update ready:', e.detail);
    updateAvailable.value = true;
  });

  // Listen for back press dispatched from Android
  window.addEventListener('android-back', () => {
    if (confirmDialog.value.isOpen) {
      confirmDialog.value.isOpen = false;
    } else if (isFolderModalOpen.value) {
      isFolderModalOpen.value = false;
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
