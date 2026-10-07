<template>
  <div class="space-y-2 select-none">
    <!-- Folder Header Card -->
    <div
      class="flex items-center justify-between rounded-2xl shadow-sm transition-all"
      :class="[
        depth === 0
          ? 'px-3.5 py-2.5 bg-[#F3F0F7] border border-[#CAC4D0]'
          : 'px-3 py-2 bg-[#F8F5FA] border border-[#CAC4D0]/70'
      ]"
    >
      <!-- Left side: Expand/Collapse Chevron, Title, Stats -->
      <div class="flex items-center space-x-2 min-w-0 flex-1">
        <!-- Collapse / Expand Button -->
        <button
          type="button"
          @click="$emit('toggle-collapse', folder.id)"
          class="p-1 text-[#49454F] hover:text-[#1D1B20] transition-transform duration-200 shrink-0"
          :class="{ '-rotate-90': folder.isCollapsed }"
          title="Toggle collapse"
          aria-label="Toggle folder collapse"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Folder Icon & Name (Click to rename) -->
        <div
          @click="$emit('rename-folder', folder)"
          class="flex items-center space-x-1.5 min-w-0 cursor-pointer group/title"
          title="Click to rename folder"
        >
          <span class="text-sm font-extrabold uppercase tracking-tight text-[#1D1B20] truncate group-hover/title:text-[#6750A4] transition-colors">
            📁 {{ folder.name }}
          </span>
          <svg
            class="w-3.5 h-3.5 text-[#79747E] opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>

        <!-- Subfolder count badge if folder has subfolders -->
        <span
          v-if="folder.children && folder.children.length > 0"
          class="px-1.5 py-0.5 rounded-md bg-[#E6E0E9] text-[#49454F] text-[9px] font-bold shrink-0 hidden xs:inline-block"
          title="Subfolders"
        >
          {{ folder.children.length }} sub
        </span>

        <!-- Items stats pill -->
        <span class="px-2 py-0.5 rounded-full bg-[#E8DEF8] text-[#21005D] text-[10px] font-bold shrink-0">
          {{ folderStats }}
        </span>
      </div>

      <!-- Right side: Quick Add + Single Hamburger Button -->
      <div class="flex items-center space-x-1 shrink-0 relative">
        <!-- Quick Add Item Button -->
        <button
          type="button"
          @click="$emit('quick-add', folder.id)"
          class="p-1.5 rounded-xl text-[#49454F] hover:text-[#6750A4] hover:bg-white active:scale-95 transition-all"
          title="Add item to this folder"
          aria-label="Add item to folder"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <!-- The One Hamburger Button (☰) -->
        <button
          type="button"
          @click.stop="$emit('toggle-menu', folder.id)"
          class="p-1.5 rounded-xl transition-all active:scale-95"
          :class="[
            openMenuFolderId === folder.id
              ? 'bg-[#6750A4] text-white shadow-sm'
              : 'text-[#49454F] hover:text-[#1D1B20] hover:bg-white'
          ]"
          title="Folder options menu"
          aria-label="Folder options menu"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Dropdown Menu -->
        <transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <div
            v-if="openMenuFolderId === folder.id"
            class="absolute right-0 top-full mt-1.5 w-48 bg-[#FEF7FF] border border-[#CAC4D0] rounded-2xl shadow-xl py-1.5 z-40 text-xs font-semibold text-[#1D1B20] select-none backdrop-blur-md"
            @click.stop
          >
            <!-- Add Item -->
            <button
              type="button"
              @click="handleMenuAction('quick-add')"
              class="w-full px-3.5 py-2 text-left hover:bg-[#E8DEF8] flex items-center space-x-2 transition-colors text-[#21005D]"
            >
              <span class="text-sm">➕</span>
              <span>Add Item</span>
            </button>

            <!-- New Subfolder -->
            <button
              type="button"
              @click="handleMenuAction('create-subfolder')"
              class="w-full px-3.5 py-2 text-left hover:bg-[#E8DEF8] flex items-center space-x-2 transition-colors"
            >
              <span class="text-sm">📁</span>
              <span>New Subfolder</span>
            </button>

            <!-- Rename Folder -->
            <button
              type="button"
              @click="handleMenuAction('rename-folder')"
              class="w-full px-3.5 py-2 text-left hover:bg-[#E8DEF8] flex items-center space-x-2 transition-colors"
            >
              <span class="text-sm">✏️</span>
              <span>Rename</span>
            </button>

            <!-- Move Folder -->
            <button
              type="button"
              @click="handleMenuAction('move-folder')"
              class="w-full px-3.5 py-2 text-left hover:bg-[#E8DEF8] flex items-center space-x-2 transition-colors"
            >
              <span class="text-sm">📦</span>
              <span>Move Folder...</span>
            </button>

            <!-- Reorder Sibling Positions (Custom sort mode) -->
            <template v-if="isCustomSort">
              <div class="h-px bg-[#E6E0E9] my-1"></div>

              <button
                type="button"
                :disabled="isFirstSibling"
                @click="handleMenuAction('move-up')"
                class="w-full px-3.5 py-2 text-left hover:bg-[#E8DEF8] disabled:opacity-30 disabled:hover:bg-transparent flex items-center space-x-2 transition-colors"
              >
                <span class="text-sm">⬆️</span>
                <span>Move Up</span>
              </button>

              <button
                type="button"
                :disabled="isLastSibling"
                @click="handleMenuAction('move-down')"
                class="w-full px-3.5 py-2 text-left hover:bg-[#E8DEF8] disabled:opacity-30 disabled:hover:bg-transparent flex items-center space-x-2 transition-colors"
              >
                <span class="text-sm">⬇️</span>
                <span>Move Down</span>
              </button>
            </template>

            <div class="h-px bg-[#E6E0E9] my-1"></div>

            <!-- Delete Folder -->
            <button
              type="button"
              @click="handleMenuAction('delete-folder')"
              class="w-full px-3.5 py-2 text-left hover:bg-red-50 text-red-700 flex items-center space-x-2 transition-colors"
            >
              <span class="text-sm">🗑️</span>
              <span>Delete Folder</span>
            </button>
          </div>
        </transition>
      </div>
    </div>

    <!-- Collapsible Content (Items and Subfolders) -->
    <div
      v-if="!folder.isCollapsed"
      class="space-y-2 mt-1.5"
      :class="[
        depth === 0
          ? 'pl-2 sm:pl-3 border-l-2 border-[#CAC4D0]/50 ml-2.5 sm:ml-3'
          : 'pl-2 sm:pl-2.5 border-l-2 border-[#CAC4D0]/40 ml-2 sm:ml-2.5'
      ]"
    >
      <!-- Direct Items inside this folder -->
      <div v-if="folder.items && folder.items.length > 0" class="space-y-1.5">
        <ItemRow
          v-for="item in folder.items"
          :key="item.id"
          :item="item"
          :folders="allFolders"
          :is-custom-sort="isCustomSort"
          @update-status="(status) => $emit('update-status', item.id, status)"
          @update-text="(text) => $emit('update-text', item.id, text)"
          @update-item="(payload) => $emit('update-item', item.id, payload)"
          @move="(dir) => $emit('move-item', item.id, dir)"
        />
      </div>

      <!-- Recursive Subfolders -->
      <div v-if="folder.children && folder.children.length > 0" class="space-y-2 pt-0.5">
        <FolderSection
          v-for="(child, idx) in folder.children"
          :key="child.id"
          :folder="child"
          :depth="depth + 1"
          :all-folders="allFolders"
          :is-custom-sort="isCustomSort"
          :is-first-sibling="idx === 0"
          :is-last-sibling="idx === folder.children.length - 1"
          :open-menu-folder-id="openMenuFolderId"
          @toggle-collapse="(id) => $emit('toggle-collapse', id)"
          @create-subfolder="(parentId) => $emit('create-subfolder', parentId)"
          @rename-folder="(f) => $emit('rename-folder', f)"
          @move-folder="(f) => $emit('move-folder', f)"
          @move-position="(id, dir) => $emit('move-position', id, dir)"
          @delete-folder="(f) => $emit('delete-folder', f)"
          @quick-add="(id) => $emit('quick-add', id)"
          @toggle-menu="(id) => $emit('toggle-menu', id)"
          @close-menu="() => $emit('close-menu')"
          @update-status="(id, status) => $emit('update-status', id, status)"
          @update-text="(id, text) => $emit('update-text', id, text)"
          @update-item="(id, payload) => $emit('update-item', id, payload)"
          @move-item="(id, dir) => $emit('move-item', id, dir)"
        />
      </div>

      <!-- Empty folder message if both items and subfolders are empty -->
      <div
        v-if="(!folder.items || folder.items.length === 0) && (!folder.children || folder.children.length === 0)"
        class="py-2.5 px-3.5 text-center text-xs font-semibold text-[#79747E] bg-white/50 rounded-2xl border border-dashed border-[#CAC4D0]"
      >
        Empty folder.
        <button
          type="button"
          @click="$emit('quick-add', folder.id)"
          class="ml-1 text-[#6750A4] font-bold hover:underline"
        >
          + Add Item
        </button>
        <span class="mx-1 text-[#CAC4D0]">•</span>
        <button
          type="button"
          @click="$emit('create-subfolder', folder.id)"
          class="text-[#6750A4] font-bold hover:underline"
        >
          + Subfolder
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ItemRow from './ItemRow.vue';

defineOptions({
  name: 'FolderSection'
});

const props = defineProps({
  folder: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  allFolders: {
    type: Array,
    default: () => []
  },
  isCustomSort: {
    type: Boolean,
    default: false
  },
  isFirstSibling: {
    type: Boolean,
    default: false
  },
  isLastSibling: {
    type: Boolean,
    default: false
  },
  openMenuFolderId: {
    type: String,
    default: null
  }
});

const emit = defineEmits([
  'toggle-collapse',
  'create-subfolder',
  'rename-folder',
  'move-folder',
  'move-position',
  'delete-folder',
  'quick-add',
  'toggle-menu',
  'close-menu',
  'update-status',
  'update-text',
  'update-item',
  'move-item'
]);

function getSubtreeItems(f) {
  let all = [...(f.items || [])];
  if (Array.isArray(f.children)) {
    for (const child of f.children) {
      all = all.concat(getSubtreeItems(child));
    }
  }
  return all;
}

const folderStats = computed(() => {
  const items = getSubtreeItems(props.folder);
  if (!items || items.length === 0) return '0';
  const completed = items.filter(i => i.status === 'completed').length;
  const active = items.filter(i => i.status !== 'deleted').length;
  return `${completed}/${active}`;
});

function handleMenuAction(action) {
  emit('close-menu');
  switch (action) {
    case 'quick-add':
      emit('quick-add', props.folder.id);
      break;
    case 'create-subfolder':
      emit('create-subfolder', props.folder.id);
      break;
    case 'rename-folder':
      emit('rename-folder', props.folder);
      break;
    case 'move-folder':
      emit('move-folder', props.folder);
      break;
    case 'move-up':
      emit('move-position', props.folder.id, 'up');
      break;
    case 'move-down':
      emit('move-position', props.folder.id, 'down');
      break;
    case 'delete-folder':
      emit('delete-folder', props.folder);
      break;
  }
}
</script>
