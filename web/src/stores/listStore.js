import { defineStore } from 'pinia';
import { generateUUID, deriveRoomCredentials } from '../services/crypto.js';
import {
  dbGetAllLists,
  dbSaveList,
  dbSaveAllLists,
  dbGetConfig,
  dbSetConfig,
  dbRemoveConfig
} from '../services/db.js';
import { syncEngine } from '../services/webrtc.js';
import { syncLogger } from '../services/logger.js';
import { CONFIG } from '../config.js';

export const useListStore = defineStore('lists', {
  state: () => ({
    isLoaded: false,
    lists: [],
    activeListId: null,
    isSyncing: false,
    
    // Setup & Configuration
    sharedPhrase: '',
    roomCredentials: null,
    signalingUrl: CONFIG.DEFAULT_SIGNALING_URL,
    
    // UI States
    isSidebarOpen: false,
    isSetupModalOpen: false,
    isImportModalOpen: false,
    isSettingsModalOpen: false,
    sortMode: 'custom', // 'custom' | 'text-asc' | 'text-desc' | 'status' | 'created-desc' | 'created-asc'
    showDeleted: false,
    searchQuery: '',
    
    // Sync status
    syncState: {
      status: 'disconnected',
      peerCount: 0,
      connectedPeers: [],
      myPeerId: '',
      roomId: ''
    }
  }),

  getters: {
    activeLists: (state) => {
      return state.lists.filter(l => l.status === 'active');
    },

    activeList: (state) => {
      if (!state.activeListId) {
        const firstActive = state.lists.find(l => l.status === 'active');
        return firstActive || null;
      }
      return state.lists.find(l => l.id === state.activeListId) || null;
    },

    activeListItems: (state) => {
      const list = state.lists.find(l => l.id === state.activeListId);
      if (!list || !list.items) return [];
      return list.items;
    },

    sortedItems: (state) => {
      const list = state.lists.find(l => l.id === state.activeListId);
      if (!list || !Array.isArray(list.items)) return [];

      let filtered = list.items.filter(item => {
        if (!state.showDeleted && item.status === 'deleted') {
          return false;
        }
        if (state.searchQuery.trim()) {
          return item.text.toLowerCase().includes(state.searchQuery.trim().toLowerCase());
        }
        return true;
      });

      // Sort copy based on selected mode
      const items = [...filtered];

      switch (state.sortMode) {
        case 'custom':
          items.sort((a, b) => (a.position || 0) - (b.position || 0));
          break;
        case 'text-asc':
          items.sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }));
          break;
        case 'text-desc':
          items.sort((a, b) => b.text.localeCompare(a.text, undefined, { sensitivity: 'base' }));
          break;
        case 'status': {
          const statusOrder = { open: 1, completed: 2, deleted: 3 };
          items.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));
          break;
        }
        case 'created-desc':
          items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          break;
        case 'created-asc':
          items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          break;
      }

      return items;
    },

    maskedPhrase: (state) => {
      if (!state.sharedPhrase) return '';
      if (state.sharedPhrase.length <= 4) return '••••';
      return state.sharedPhrase.substring(0, 2) + '••••••••' + state.sharedPhrase.substring(state.sharedPhrase.length - 2);
    }
  },

  actions: {
    async initApp() {
      // 1. Listen for WebRTC status & incoming DataChannel sync messages
      syncEngine.onStatusChange((info) => {
        this.syncState = info;
      });

      syncEngine.onMessage((msg, fromPeerId) => {
        this.handlePeerMessage(msg, fromPeerId);
      });

      // 2. Load stored configuration
      const storedPhrase = await dbGetConfig('sharedPhrase');
      const storedSignalingUrl = await dbGetConfig('signalingUrl');
      const storedActiveListId = await dbGetConfig('activeListId');
      const storedSortMode = await dbGetConfig('sortMode');

      if (storedSignalingUrl) {
        this.signalingUrl = storedSignalingUrl;
      }
      if (storedSortMode) {
        this.sortMode = storedSortMode;
      }

      // 3. Load all lists from IndexedDB
      const loadedLists = await dbGetAllLists();
      this.lists = loadedLists;

      // 4. If no lists exist, create default welcome list
      if (this.lists.length === 0) {
        const welcomeList = this.createInitialWelcomeList();
        this.lists.push(welcomeList);
        await dbSaveList(welcomeList);
      }

      // Set active list
      if (storedActiveListId && this.lists.some(l => l.id === storedActiveListId && l.status === 'active')) {
        this.activeListId = storedActiveListId;
      } else {
        const firstActive = this.lists.find(l => l.status === 'active');
        this.activeListId = firstActive ? firstActive.id : this.lists[0]?.id;
      }

      // 5. Check if shared phrase is configured
      if (storedPhrase) {
        this.sharedPhrase = storedPhrase;
        await this.startSyncWithPhrase(storedPhrase);
      } else {
        this.isSetupModalOpen = true;
      }

      this.isLoaded = true;
    },

    createInitialWelcomeList() {
      const now = Date.now();
      return {
        id: generateUUID(),
        name: 'My Tasks',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        items: [
          {
            id: generateUUID(),
            text: 'Swipe right to complete this item ➡️',
            status: 'open',
            position: 1,
            createdAt: now,
            updatedAt: now
          },
          {
            id: generateUUID(),
            text: 'Swipe right again to soft-delete 🗑️',
            status: 'open',
            position: 2,
            createdAt: now + 1,
            updatedAt: now + 1
          },
          {
            id: generateUUID(),
            text: 'Swipe left to revert status ⬅️',
            status: 'completed',
            position: 3,
            createdAt: now + 2,
            updatedAt: now + 2
          },
          {
            id: generateUUID(),
            text: 'Sync across devices with the same shared phrase ⚡',
            status: 'open',
            position: 4,
            createdAt: now + 3,
            updatedAt: now + 3
          }
        ]
      };
    },

    async configurePhrase(phrase) {
      const trimmed = (phrase || '').trim();
      if (!trimmed) return false;

      this.sharedPhrase = trimmed;
      await dbSetConfig('sharedPhrase', trimmed);
      await this.startSyncWithPhrase(trimmed);
      this.isSetupModalOpen = false;
      return true;
    },

    async resetPhrase() {
      syncEngine.disconnect();
      this.sharedPhrase = '';
      this.roomCredentials = null;
      await dbRemoveConfig('sharedPhrase');
      this.isSetupModalOpen = true;
      this.isSettingsModalOpen = false;
    },

    async updateSignalingUrl(newUrl) {
      const trimmed = (newUrl || '').trim();
      if (!trimmed) return;
      this.signalingUrl = trimmed;
      await dbSetConfig('signalingUrl', trimmed);
      if (this.roomCredentials) {
        syncEngine.disconnect();
        syncEngine.connect(this.roomCredentials.roomId, this.signalingUrl);
      }
    },

    async startSyncWithPhrase(phrase) {
      try {
        const credentials = await deriveRoomCredentials(phrase);
        this.roomCredentials = credentials;
        syncEngine.connect(credentials.roomId, this.signalingUrl);
      } catch (err) {
        console.error('Failed to derive credentials and connect:', err);
      }
    },

    setActiveList(listId) {
      this.activeListId = listId;
      this.isSidebarOpen = false;
      dbSetConfig('activeListId', listId).catch(() => {});
    },

    setSortMode(mode) {
      this.sortMode = mode;
      dbSetConfig('sortMode', mode).catch(() => {});
    },

    toggleShowDeleted() {
      this.showDeleted = !this.showDeleted;
    },

    // --- List Operations ---

    async createList(name) {
      const trimmed = (name || '').trim() || 'Untitled List';
      const now = Date.now();
      const newList = {
        id: generateUUID(),
        name: trimmed,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        items: []
      };

      this.lists.push(newList);
      this.activeListId = newList.id;
      this.isSidebarOpen = false;

      await dbSaveList(newList);
      this.broadcastMutation({
        type: 'list_upsert',
        list: newList
      });

      return newList;
    },

    async renameList(listId, newName) {
      const trimmed = (newName || '').trim();
      if (!trimmed) return;

      const list = this.lists.find(l => l.id === listId);
      if (!list) return;

      list.name = trimmed;
      list.updatedAt = Date.now();

      await dbSaveList(list);
      this.broadcastMutation({
        type: 'list_metadata',
        listId: list.id,
        name: list.name,
        status: list.status,
        updatedAt: list.updatedAt
      });
    },

    async deleteList(listId) {
      const list = this.lists.find(l => l.id === listId);
      if (!list) return;

      const now = Date.now();
      list.status = 'deleted';
      list.updatedAt = now;

      // Select another active list if the deleted one was active
      if (this.activeListId === listId) {
        const nextActive = this.lists.find(l => l.id !== listId && l.status === 'active');
        this.activeListId = nextActive ? nextActive.id : null;
      }

      await dbSaveList(list);
      this.broadcastMutation({
        type: 'list_metadata',
        listId: list.id,
        name: list.name,
        status: list.status,
        updatedAt: list.updatedAt
      });
    },

    async duplicateList(listId) {
      const source = this.lists.find(l => l.id === listId);
      if (!source) return;

      const now = Date.now();
      // Copy only active (non-deleted) items, generate completely new UUIDs, set to 'open'
      const activeItems = (source.items || []).filter(item => item.status !== 'deleted');
      const copiedItems = activeItems.map((item, idx) => ({
        id: generateUUID(),
        text: item.text,
        status: 'open',
        position: idx + 1,
        createdAt: now + idx,
        updatedAt: now + idx
      }));

      const duplicatedList = {
        id: generateUUID(),
        name: `${source.name} (Copy)`,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        items: copiedItems
      };

      this.lists.push(duplicatedList);
      this.activeListId = duplicatedList.id;
      this.isSidebarOpen = false;

      await dbSaveList(duplicatedList);
      this.broadcastMutation({
        type: 'list_upsert',
        list: duplicatedList
      });

      return duplicatedList;
    },

    async resetList(listId) {
      const list = this.lists.find(l => l.id === listId);
      if (!list || !Array.isArray(list.items)) return;

      const now = Date.now();
      let changed = false;

      for (const item of list.items) {
        if (item.status !== 'deleted' && item.status !== 'open') {
          item.status = 'open';
          item.updatedAt = now;
          changed = true;
        }
      }

      if (changed) {
        list.updatedAt = now;
        await dbSaveList(list);
        this.broadcastMutation({
          type: 'list_reset',
          listId: list.id,
          updatedAt: list.updatedAt,
          items: list.items
        });
      }
    },

    // --- Item Operations ---

    async addItem(listId, text) {
      const trimmed = (text || '').trim();
      if (!trimmed) return null;

      const list = this.lists.find(l => l.id === listId);
      if (!list) return null;

      if (!Array.isArray(list.items)) {
        list.items = [];
      }

      const now = Date.now();
      const maxPosition = list.items.reduce((max, i) => Math.max(max, i.position || 0), 0);

      const newItem = {
        id: generateUUID(),
        text: trimmed,
        status: 'open',
        position: maxPosition + 1,
        createdAt: now,
        updatedAt: now
      };

      list.items.push(newItem);
      list.updatedAt = now;

      await dbSaveList(list);
      this.broadcastMutation({
        type: 'item_upsert',
        listId: list.id,
        item: newItem
      });

      return newItem;
    },

    async importItems(listId, textBlob) {
      if (!textBlob) return;
      const lines = textBlob
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (lines.length === 0) return;

      const list = this.lists.find(l => l.id === listId);
      if (!list) return;

      if (!Array.isArray(list.items)) {
        list.items = [];
      }

      const now = Date.now();
      let currentPosition = list.items.reduce((max, i) => Math.max(max, i.position || 0), 0);

      const newItems = [];
      lines.forEach((line, idx) => {
        currentPosition++;
        const item = {
          id: generateUUID(),
          text: line,
          status: 'open',
          position: currentPosition,
          createdAt: now + idx,
          updatedAt: now + idx
        };
        list.items.push(item);
        newItems.push(item);
      });

      list.updatedAt = now + lines.length;
      await dbSaveList(list);

      for (const item of newItems) {
        this.broadcastMutation({
          type: 'item_upsert',
          listId: list.id,
          item
        });
      }

      this.isImportModalOpen = false;
    },

    async updateItemText(listId, itemId, newText) {
      const trimmed = (newText || '').trim();
      if (!trimmed) return;

      const list = this.lists.find(l => l.id === listId);
      if (!list || !Array.isArray(list.items)) return;

      const item = list.items.find(i => i.id === itemId);
      if (!item) return;

      item.text = trimmed;
      item.updatedAt = Date.now();
      list.updatedAt = item.updatedAt;

      await dbSaveList(list);
      this.broadcastMutation({
        type: 'item_upsert',
        listId: list.id,
        item
      });
    },

    async updateItemStatus(listId, itemId, newStatus) {
      const list = this.lists.find(l => l.id === listId);
      if (!list || !Array.isArray(list.items)) return;

      const item = list.items.find(i => i.id === itemId);
      if (!item) return;

      item.status = newStatus;
      item.updatedAt = Date.now();
      list.updatedAt = item.updatedAt;

      await dbSaveList(list);
      this.broadcastMutation({
        type: 'item_upsert',
        listId: list.id,
        item
      });
    },

    async moveItemPosition(listId, itemId, direction) {
      const list = this.lists.find(l => l.id === listId);
      if (!list || !Array.isArray(list.items)) return;

      // Sort items by position to find adjacent target
      const visibleItems = [...list.items]
        .filter(i => this.showDeleted || i.status !== 'deleted')
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      const currentIndex = visibleItems.findIndex(i => i.id === itemId);
      if (currentIndex === -1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= visibleItems.length) return;

      const currentItem = visibleItems[currentIndex];
      const targetItem = visibleItems[targetIndex];

      const now = Date.now();
      const tempPos = currentItem.position;
      currentItem.position = targetItem.position;
      targetItem.position = tempPos;

      currentItem.updatedAt = now;
      targetItem.updatedAt = now + 1;
      list.updatedAt = now + 1;

      await dbSaveList(list);
      this.broadcastMutation({
        type: 'item_upsert',
        listId: list.id,
        item: currentItem
      });
      this.broadcastMutation({
        type: 'item_upsert',
        listId: list.id,
        item: targetItem
      });
    },

    // --- Deterministic LWW Synchronization Protocol ---

    async syncNow() {
      if (this.isSyncing) return;
      this.isSyncing = true;
      syncLogger.info('SYNC', 'User initiated manual sync request');

      try {
        const res = syncEngine.triggerSyncNow();
        if (this.syncState.peerCount > 0) {
          this.broadcastSyncState();
        }
        return res;
      } finally {
        setTimeout(() => {
          this.isSyncing = false;
        }, 1200);
      }
    },

    broadcastSyncState() {
      syncLogger.info('SYNC', `Broadcasting state snapshot (${this.lists.length} lists) to all peers`);
      syncEngine.broadcast({
        type: 'sync_state',
        lists: this.lists,
        sentAt: Date.now()
      });
    },

    broadcastMutation(mutation) {
      syncLogger.debug('SYNC', `Broadcasting mutation ${mutation.type}`);
      syncEngine.broadcast({
        type: 'mutation',
        mutation,
        sentAt: Date.now()
      });
    },

    handlePeerMessage(msg, fromPeerId) {
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'channel_opened':
        case 'request_sync':
          // Peer connected or requested sync: send our current state
          syncLogger.info('SYNC', `Peer ${fromPeerId} requested sync state (${this.lists.length} lists)`);
          syncEngine.sendToPeer(fromPeerId, {
            type: 'sync_state',
            lists: this.lists,
            sentAt: Date.now()
          });
          break;

        case 'sync_state':
          if (Array.isArray(msg.lists)) {
            syncLogger.success('SYNC', `Received state from ${fromPeerId} (${msg.lists.length} lists)`);
            const hasNewerLocalData = this.mergeRemoteState(msg.lists);
            if (hasNewerLocalData) {
              syncLogger.info('SYNC', `Local state has newer updates -> replying with merged state to ${fromPeerId}`);
              // Send back updated merged state so peer gets the newer changes
              syncEngine.sendToPeer(fromPeerId, {
                type: 'sync_state',
                lists: this.lists,
                sentAt: Date.now()
              });
            }
          }
          break;

        case 'mutation':
          if (msg.mutation) {
            syncLogger.info('SYNC', `Applying remote mutation from ${fromPeerId}: ${msg.mutation.type}`);
            this.applyRemoteMutation(msg.mutation);
          }
          break;
      }
    },

    /**
     * Deterministic Last-Write-Wins comparison helper
     * Rules:
     * 1. Compare updatedAt timestamps
     * 2. If equal, lexicographical compare of UUID
     */
    isRemoteWinning(remoteUpdatedAt, remoteId, localUpdatedAt, localId) {
      if (remoteUpdatedAt > localUpdatedAt) return true;
      if (remoteUpdatedAt < localUpdatedAt) return false;
      return remoteId > localId;
    },

    applyRemoteMutation(mutation) {
      if (!mutation || !mutation.type) return;

      let changed = false;

      switch (mutation.type) {
        case 'list_upsert': {
          const remoteList = mutation.list;
          if (!remoteList || !remoteList.id) return;
          const localList = this.lists.find(l => l.id === remoteList.id);

          if (!localList) {
            this.lists.push(remoteList);
            changed = true;
          } else {
            changed = this.mergeSingleList(localList, remoteList);
          }
          break;
        }

        case 'list_metadata': {
          const { listId, name, status, updatedAt } = mutation;
          const localList = this.lists.find(l => l.id === listId);
          if (localList) {
            if (this.isRemoteWinning(updatedAt, listId, localList.updatedAt, localList.id)) {
              localList.name = name;
              localList.status = status;
              localList.updatedAt = updatedAt;
              changed = true;
            }
          }
          break;
        }

        case 'list_reset': {
          const { listId, updatedAt, items } = mutation;
          const localList = this.lists.find(l => l.id === listId);
          if (localList && Array.isArray(items)) {
            for (const remoteItem of items) {
              const localItem = localList.items.find(i => i.id === remoteItem.id);
              if (localItem) {
                if (this.isRemoteWinning(remoteItem.updatedAt, remoteItem.id, localItem.updatedAt, localItem.id)) {
                  localItem.status = remoteItem.status;
                  localItem.updatedAt = remoteItem.updatedAt;
                  changed = true;
                }
              }
            }
            if (updatedAt > localList.updatedAt) {
              localList.updatedAt = updatedAt;
              changed = true;
            }
          }
          break;
        }

        case 'item_upsert': {
          const { listId, item: remoteItem } = mutation;
          if (!remoteItem || !remoteItem.id) return;

          const localList = this.lists.find(l => l.id === listId);
          if (!localList) return;

          if (!Array.isArray(localList.items)) {
            localList.items = [];
          }

          const localItem = localList.items.find(i => i.id === remoteItem.id);
          if (!localItem) {
            localList.items.push(remoteItem);
            if (remoteItem.updatedAt > localList.updatedAt) {
              localList.updatedAt = remoteItem.updatedAt;
            }
            changed = true;
          } else {
            if (this.isRemoteWinning(remoteItem.updatedAt, remoteItem.id, localItem.updatedAt, localItem.id)) {
              localItem.text = remoteItem.text;
              localItem.status = remoteItem.status;
              localItem.position = remoteItem.position;
              localItem.updatedAt = remoteItem.updatedAt;
              if (remoteItem.updatedAt > localList.updatedAt) {
                localList.updatedAt = remoteItem.updatedAt;
              }
              changed = true;
            }
          }
          break;
        }
      }

      if (changed) {
        dbSaveAllLists(this.lists).catch(e => console.error('Save error after mutation:', e));
      }
    },

    mergeSingleList(localList, remoteList) {
      let changed = false;

      // 1. Compare list metadata (name & status)
      if (this.isRemoteWinning(remoteList.updatedAt, remoteList.id, localList.updatedAt, localList.id)) {
        localList.name = remoteList.name;
        localList.status = remoteList.status;
        localList.updatedAt = remoteList.updatedAt;
        changed = true;
      }

      // 2. Merge items independently (Item LWW)
      if (!Array.isArray(localList.items)) localList.items = [];
      const remoteItems = Array.isArray(remoteList.items) ? remoteList.items : [];

      for (const remoteItem of remoteItems) {
        const localItem = localList.items.find(i => i.id === remoteItem.id);
        if (!localItem) {
          localList.items.push(remoteItem);
          changed = true;
        } else {
          if (this.isRemoteWinning(remoteItem.updatedAt, remoteItem.id, localItem.updatedAt, localItem.id)) {
            localItem.text = remoteItem.text;
            localItem.status = remoteItem.status;
            localItem.position = remoteItem.position;
            localItem.updatedAt = remoteItem.updatedAt;
            changed = true;
          }
        }
      }

      return changed;
    },

    mergeRemoteState(remoteLists) {
      let localChanged = false;
      let hasLocalNewerData = false;

      for (const remoteList of remoteLists) {
        const localList = this.lists.find(l => l.id === remoteList.id);
        if (!localList) {
          this.lists.push(remoteList);
          localChanged = true;
        } else {
          const listChanged = this.mergeSingleList(localList, remoteList);
          if (listChanged) localChanged = true;
          if (localList.updatedAt > remoteList.updatedAt) {
            hasLocalNewerData = true;
          }
        }
      }

      // Check if local has lists unknown to remote
      for (const localList of this.lists) {
        if (!remoteLists.some(r => r.id === localList.id)) {
          hasLocalNewerData = true;
        }
      }

      if (localChanged) {
        dbSaveAllLists(this.lists).catch(e => console.error('Save all lists failed:', e));
      }

      return hasLocalNewerData;
    }
  }
});
