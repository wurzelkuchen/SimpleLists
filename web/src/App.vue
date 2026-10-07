<template>
  <div class="h-full w-full flex flex-col bg-[#FEF7FF] text-[#1D1B20] overflow-hidden select-none font-sans">
    <!-- Top Bar -->
    <TopBar
      @open-sort="isSortSelectorOpen = true"
      @create-folder="openCreateFolderModal(null)"
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
          <!-- Unassigned / General Header Card (if unassigned items exist) -->
          <div
            v-if="store.unassignedItems.length > 0"
            class="space-y-2"
          >
            <div
              class="flex items-center justify-between px-3.5 py-2.5 bg-[#F3F0F7]/80 border border-[#CAC4D0]/80 rounded-2xl shadow-sm transition-all"
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
                  {{ getFolderStats(store.unassignedItems) }}
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

            <!-- Items inside General -->
            <div
              v-if="!isGeneralCollapsed"
              class="space-y-1.5 pl-2 sm:pl-3 border-l-2 border-[#CAC4D0]/40 ml-2.5 sm:ml-3"
            >
              <ItemRow
                v-for="item in store.unassignedItems"
                :key="item.id"
                :item="item"
                :folders="store.activeListFoldersWithHierarchy"
                :is-custom-sort="store.sortMode === 'custom'"
                @update-status="(status) => handleUpdateStatus(item.id, status)"
                @update-text="(text) => handleUpdateText(item.id, text)"
                @update-item="(payload) => handleUpdateItem(item.id, payload)"
                @move="(dir) => handleMoveItem(item.id, dir)"
              />
            </div>
          </div>

          <!-- Root Folders (and their nested subfolders recursively) -->
          <div class="space-y-3">
            <FolderSection
              v-for="(rootFolder, idx) in store.activeListFoldersTree"
              :key="rootFolder.id"
              :folder="rootFolder"
              :depth="0"
              :all-folders="store.activeListFoldersWithHierarchy"
              :is-custom-sort="store.sortMode === 'custom'"
              :is-first-sibling="idx === 0"
              :is-last-sibling="idx === store.activeListFoldersTree.length - 1"
              :open-menu-folder-id="openMenuFolderId"
              @toggle-collapse="(id) => store.toggleFolderCollapse(store.activeList.id, id)"
              @create-subfolder="(parentId) => openCreateFolderModal(parentId)"
              @rename-folder="(f) => openRenameFolderModal(f)"
              @move-folder="(f) => openMoveFolderModal(f)"
              @move-position="(id, dir) => store.moveFolderPosition(store.activeList.id, id, dir)"
              @delete-folder="(f) => confirmDeleteFolder(f)"
              @quick-add="(id) => triggerAddForFolder(id)"
              @toggle-menu="(id) => toggleFolderMenu(id)"
              @close-menu="openMenuFolderId = null"
              @update-status="(id, status) => handleUpdateStatus(id, status)"
              @update-text="(id, text) => handleUpdateText(id, text)"
              @update-item="(id, payload) => handleUpdateItem(id, payload)"
              @move-item="(id, dir) => handleMoveItem(id, dir)"
            />
          </div>

          <!-- Bottom Add Folder Button -->
          <div class="pt-2 flex justify-center">
            <button
              type="button"
              @click="openCreateFolderModal(null)"
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
            :folders="store.activeListFoldersWithHierarchy"
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
              @click="openCreateFolderModal(null)"
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
              @click="openCreateFolderModal(null)"
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
      :folders="store.activeListFoldersWithHierarchy"
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
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-extrabold uppercase tracking-tight text-[#1D1B20] truncate">
              {{ folderModalMode === 'create' ? (targetParentFolderName ? `Subfolder in "${targetParentFolderName}"` : 'New Folder / Section') : 'Rename Folder' }}
            </h3>
            <p v-if="folderModalMode === 'create' && targetParentFolderName" class="text-[10px] text-[#49454F] truncate font-medium">
              Parent: {{ targetParentFolderName }}
            </p>
          </div>
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

    <MoveFolderModal
      :is-open="isMoveModalOpen"
      :folder="movingFolder"
      :all-folders="store.activeListFoldersWithHierarchy"
      :descendant-ids="movingFolderDescendantIds"
      @close="isMoveModalOpen = false"
      @move="handleMoveFolderConfirm"
    />

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
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
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
import FolderSection from './components/FolderSection.vue';
import MoveFolderModal from './components/MoveFolderModal.vue';

const store = useListStore();

const addItemInputRef = ref(null);
const isSortSelectorOpen = ref(false);
const updateAvailable = ref(false);
const isGeneralCollapsed = ref(false);

// Active hamburger menu folder ID (only 1 open at a time)
const openMenuFolderId = ref(null);

function toggleFolderMenu(folderId) {
  openMenuFolderId.value = openMenuFolderId.value === folderId ? null : folderId;
}

// Move Folder Modal state
const isMoveModalOpen = ref(false);
const movingFolder = ref(null);
const movingFolderDescendantIds = computed(() => {
  if (!movingFolder.value || !store.activeList) return new Set();
  return store.getFolderDescendantIds(store.activeList.id, movingFolder.value.id);
});

function openMoveFolderModal(folder) {
  movingFolder.value = folder;
  isMoveModalOpen.value = true;
}

function handleMoveFolderConfirm({ folderId, newParentId }) {
  if (store.activeList) {
    store.moveFolderParent(store.activeList.id, folderId, newParentId);
  }
  isMoveModalOpen.value = false;
  movingFolder.value = null;
}

// Folder Create/Rename Modal state
const isFolderModalOpen = ref(false);
const folderModalMode = ref('create'); // 'create' | 'rename'
const folderModalName = ref('');
const editingFolderId = ref(null);
const targetParentFolderId = ref(null);
const folderModalInput = ref(null);

const targetParentFolderName = computed(() => {
  if (!targetParentFolderId.value || !store.activeListFolders) return null;
  const f = store.activeListFolders.find(folder => folder.id === targetParentFolderId.value);
  return f ? f.name : null;
});

function openCreateFolderModal(parentId = null) {
  folderModalMode.value = 'create';
  targetParentFolderId.value = parentId;
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
  targetParentFolderId.value = folder.parentId || null;
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
    store.createFolder(store.activeList.id, trimmed, targetParentFolderId.value);
  } else if (folderModalMode.value === 'rename' && editingFolderId.value) {
    store.renameFolder(store.activeList.id, editingFolderId.value, trimmed);
  }
  isFolderModalOpen.value = false;
}

function confirmDeleteFolder(folder) {
  openConfirmModal({
    title: `Delete Folder "${folder.name}"?`,
    message: 'Any subfolders will be moved to the parent folder / top level, and items will be kept in General.',
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
  if (window.AndroidBridge && typeof window.AndroidBridge.reloadApp === 'function') {
    window.AndroidBridge.reloadApp();
  } else {
    window.location.reload();
  }
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

function handleGlobalClick() {
  if (openMenuFolderId.value) {
    openMenuFolderId.value = null;
  }
}

function handleAndroidBack() {
  if (confirmDialog.value.isOpen) {
    confirmDialog.value.isOpen = false;
  } else if (openMenuFolderId.value) {
    openMenuFolderId.value = null;
  } else if (isMoveModalOpen.value) {
    isMoveModalOpen.value = false;
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
}

onMounted(() => {
  store.initApp();

  window.addEventListener('click', handleGlobalClick);

  // Listen for OTA update notifications from Android
  window.addEventListener('web-update-ready', (e) => {
    console.log('Web update ready:', e.detail);
    updateAvailable.value = true;
  });

  // Listen for back press dispatched from Android
  window.addEventListener('android-back', handleAndroidBack);
});

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick);
  window.removeEventListener('android-back', handleAndroidBack);
});
</script>
