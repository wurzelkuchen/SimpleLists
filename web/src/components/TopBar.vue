<template>
  <header class="bg-[#FEF7FF]/95 backdrop-blur-md border-b border-[#E6E0E9] px-4 py-3 sticky top-0 z-20 shrink-0 select-none">
    <div class="max-w-4xl mx-auto flex items-center justify-between gap-2">
      <!-- Left: Hamburger button & List title -->
      <div class="flex items-center space-x-3 min-w-0 flex-1">
        <button
          @click="store.isSidebarOpen = true"
          class="w-10 h-10 flex items-center justify-center rounded-full text-[#1D1B20] hover:bg-[#F3F0F7] active:bg-[#E8DEF8] active:scale-95 transition-all shrink-0"
          title="Open lists menu"
          aria-label="Open lists menu"
        >
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Editable list name / simple lists branding -->
        <div class="min-w-0 flex-1">
          <div v-if="isEditingTitle" class="flex items-center">
            <input
              ref="titleInput"
              v-model="editTitle"
              type="text"
              class="w-full bg-white border-2 border-[#6750A4] rounded-lg px-2.5 py-1 text-base font-bold text-[#1D1B20] focus:outline-none shadow-sm"
              @blur="saveTitle"
              @keydown.enter.prevent="saveTitle"
              @keydown.esc="isEditingTitle = false"
            />
          </div>
          <div
            v-else
            @click="startEditingTitle"
            class="flex items-center space-x-2 cursor-pointer group"
            title="Click to rename list"
          >
            <h1 class="text-lg sm:text-xl font-bold tracking-tight text-[#1D1B20] truncate group-hover:text-[#6750A4] transition-colors">
              {{ store.activeList?.name || 'Simple Lists' }}
            </h1>
            <svg class="w-3.5 h-3.5 text-[#49454F] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Right: Sync status & Actions -->
      <div class="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
        <!-- Live Sync Status Pill -->
        <button
          @click="store.isSettingsModalOpen = true"
          class="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm"
          :class="[
            store.syncState.peerCount > 0 
              ? 'bg-[#E8DEF8] text-[#21005D] border border-[#CAC4D0]/60'
              : store.syncState.status === 'connecting'
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-[#F3F0F7] text-[#49454F] border border-[#CAC4D0]/60'
          ]"
          :title="`Sync Status: ${syncLabel}. Click for details.`"
        >
          <!-- Status pulsing dot -->
          <span class="relative flex h-2 w-2">
            <span
              v-if="store.syncState.peerCount > 0"
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"
            ></span>
            <span
              class="relative inline-flex rounded-full h-2 w-2"
              :class="[
                store.syncState.peerCount > 0 ? 'bg-emerald-600' :
                store.syncState.status === 'connecting' ? 'bg-amber-500 animate-pulse' :
                'bg-slate-400'
              ]"
            ></span>
          </span>
          <span class="hidden sm:inline">{{ syncLabel }}</span>
          <span v-if="store.syncState.peerCount > 0" class="sm:hidden font-mono text-[11px]">{{ store.syncState.peerCount }}p</span>
        </button>

        <!-- Sort selector toggle -->
        <button
          @click="$emit('open-sort')"
          class="p-2 rounded-xl text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7] active:scale-95 transition-all"
          :class="{ 'text-[#6750A4] bg-[#E8DEF8] font-bold': store.sortMode !== 'custom' }"
          title="Sort list"
          aria-label="Sort items"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
        </button>

        <!-- Show/Hide Deleted toggle -->
        <button
          @click="store.toggleShowDeleted"
          class="p-2 rounded-xl text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7] active:scale-95 transition-all relative"
          :class="{ 'text-red-700 bg-red-100 font-bold': store.showDeleted }"
          :title="store.showDeleted ? 'Hide deleted items' : 'Show deleted items'"
          aria-label="Toggle deleted items"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span 
            v-if="deletedCount > 0" 
            class="absolute -top-1 -right-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-600 text-white"
          >
            {{ deletedCount }}
          </span>
        </button>

        <!-- Import items button -->
        <button
          @click="store.isImportModalOpen = true"
          class="p-2 rounded-xl text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7] active:scale-95 transition-all"
          title="Import items"
          aria-label="Import items from text"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { useListStore } from '../stores/listStore.js';

const store = useListStore();
defineEmits(['open-sort']);

const isEditingTitle = ref(false);
const editTitle = ref('');
const titleInput = ref(null);

const deletedCount = computed(() => {
  const list = store.activeList;
  if (!list || !Array.isArray(list.items)) return 0;
  return list.items.filter(i => i.status === 'deleted').length;
});

const syncLabel = computed(() => {
  if (store.syncState.peerCount > 0) {
    return `${store.syncState.peerCount} ${store.syncState.peerCount === 1 ? 'Peer' : 'Peers'}`;
  }
  if (store.syncState.status === 'connecting') {
    return 'Connecting';
  }
  return 'Offline';
});

function startEditingTitle() {
  if (!store.activeList) return;
  editTitle.value = store.activeList.name;
  isEditingTitle.value = true;
  nextTick(() => {
    if (titleInput.value) {
      titleInput.value.focus();
      titleInput.value.select();
    }
  });
}

function saveTitle() {
  if (!isEditingTitle.value) return;
  const trimmed = editTitle.value.trim();
  if (trimmed && store.activeList && trimmed !== store.activeList.name) {
    store.renameList(store.activeList.id, trimmed);
  }
  isEditingTitle.value = false;
}
</script>
