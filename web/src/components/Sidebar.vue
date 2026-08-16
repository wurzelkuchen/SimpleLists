<template>
  <div>
    <!-- Backdrop overlay -->
    <transition
      enter-active-class="transition-opacity ease-out duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="store.isSidebarOpen"
        @click="store.isSidebarOpen = false"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
      ></div>
    </transition>

    <!-- Side drawer panel -->
    <transition
      enter-active-class="transition-transform ease-out duration-300"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform ease-in duration-200"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="store.isSidebarOpen"
        class="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-[#FEF7FF] border-r border-[#CAC4D0] z-50 flex flex-col shadow-2xl select-none"
      >
        <!-- Header -->
        <div class="p-4 border-b border-[#E6E0E9] flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-9 h-9 rounded-xl bg-[#6750A4] flex items-center justify-center text-white shadow-md">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 class="font-extrabold text-base uppercase tracking-tight text-[#1D1B20] leading-tight">Simple Lists</h2>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-[#49454F]">P2P Sync & Offline</p>
            </div>
          </div>

          <button
            @click="store.isSidebarOpen = false"
            class="p-2 rounded-full text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7] transition-colors"
            title="Close menu"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Add New List Input Form -->
        <div class="p-3 border-b border-[#E6E0E9] bg-[#F3F0F7]">
          <form @submit.prevent="createNewList" class="flex items-center space-x-2">
            <input
              v-model="newListName"
              type="text"
              placeholder="+ New List Name..."
              class="flex-1 bg-white border-2 border-[#CAC4D0] focus:border-[#6750A4] rounded-xl px-3 py-2 text-xs font-medium text-[#1D1B20] placeholder-[#79747E] focus:outline-none shadow-sm"
            />
            <button
              type="submit"
              :disabled="!newListName.trim()"
              class="px-3.5 py-2 bg-[#6750A4] hover:bg-[#533f86] disabled:opacity-40 disabled:hover:bg-[#6750A4] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm shrink-0"
            >
              Add
            </button>
          </form>
        </div>

        <!-- Lists Scroll Area -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <div
            v-for="list in store.activeLists"
            :key="list.id"
            @click="store.setActiveList(list.id)"
            class="group relative flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border shadow-sm"
            :class="[
              store.activeListId === list.id
                ? 'bg-[#E8DEF8] border-[#6750A4] text-[#21005D]'
                : 'bg-white border-[#CAC4D0]/60 hover:border-[#6750A4]/40 hover:bg-[#F3F0F7] text-[#1D1B20]'
            ]"
          >
            <!-- Left: List Name & item counters -->
            <div class="min-w-0 flex-1 pr-2">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-sm truncate uppercase tracking-tight">{{ list.name }}</span>
              </div>
              <div class="text-[11px] font-semibold uppercase tracking-wider mt-0.5" :class="store.activeListId === list.id ? 'text-[#49454F]' : 'text-[#79747E]'">
                {{ getListStats(list) }}
              </div>
            </div>

            <!-- Right: Actions Menu Trigger -->
            <div class="flex items-center space-x-1 shrink-0">
              <!-- Quick Duplicate -->
              <button
                @click.stop="duplicateList(list)"
                class="p-1.5 rounded-lg text-[#49454F] hover:text-[#6750A4] hover:bg-white/80 opacity-60 group-hover:opacity-100 transition-all"
                title="Duplicate list"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>

              <!-- Quick Reset Items -->
              <button
                @click.stop="confirmResetList(list)"
                class="p-1.5 rounded-lg text-[#49454F] hover:text-amber-700 hover:bg-white/80 opacity-60 group-hover:opacity-100 transition-all"
                title="Reset all items to open"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              <!-- Delete List -->
              <button
                v-if="store.activeLists.length > 1"
                @click.stop="confirmDeleteList(list)"
                class="p-1.5 rounded-lg text-[#49454F] hover:text-red-600 hover:bg-white/80 opacity-60 group-hover:opacity-100 transition-all"
                title="Delete list"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Footer: Settings & Status -->
        <div class="p-4 border-t border-[#E6E0E9] bg-[#F3F0F7] space-y-2">
          <button
            @click="openSettings"
            class="w-full flex items-center justify-between p-3 rounded-2xl bg-white hover:bg-[#E8DEF8]/50 text-[#1D1B20] text-xs font-bold uppercase tracking-wider border border-[#CAC4D0] transition-all shadow-sm"
          >
            <div class="flex items-center space-x-2">
              <svg class="w-4 h-4 text-[#6750A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings & Sync</span>
            </div>
            <span class="text-[10px] text-[#49454F] font-mono">
              {{ store.syncState.peerCount }} peer(s)
            </span>
          </button>
        </div>
      </aside>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useListStore } from '../stores/listStore.js';

const store = useListStore();
const emit = defineEmits(['request-confirm']);

const newListName = ref('');

function createNewList() {
  const trimmed = newListName.value.trim();
  if (trimmed) {
    store.createList(trimmed);
    newListName.value = '';
  }
}

function getListStats(list) {
  if (!list.items || list.items.length === 0) return '0 items';
  const openCount = list.items.filter(i => i.status === 'open').length;
  const total = list.items.filter(i => i.status !== 'deleted').length;
  return `${openCount} open / ${total} total`;
}

function duplicateList(list) {
  store.duplicateList(list.id);
}

function confirmResetList(list) {
  emit('request-confirm', {
    title: 'Reset List Items?',
    message: `All completed items in "${list.name}" will be reset to open status. Deleted items remain deleted.`,
    confirmText: 'Reset to Open',
    confirmType: 'warning',
    action: () => store.resetList(list.id)
  });
}

function confirmDeleteList(list) {
  emit('request-confirm', {
    title: `Delete List "${list.name}"?`,
    message: 'This will soft-delete the list and hide it from all synchronized devices.',
    confirmText: 'Delete List',
    confirmType: 'danger',
    action: () => store.deleteList(list.id)
  });
}

function openSettings() {
  store.isSidebarOpen = false;
  store.isSettingsModalOpen = true;
}
</script>
