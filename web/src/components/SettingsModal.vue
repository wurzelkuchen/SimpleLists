<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 select-none">
    <div class="w-full max-w-xl bg-[#FEF7FF] border border-[#CAC4D0] rounded-3xl shadow-2xl p-5 sm:p-6 overflow-hidden flex flex-col max-h-[92vh]">
      <!-- Header -->
      <div class="flex items-center justify-between mb-3 pb-2.5 border-b border-[#E6E0E9]">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-2xl bg-[#E8DEF8] text-[#21005D] flex items-center justify-center font-bold shadow-sm">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-extrabold uppercase tracking-tight text-[#1D1B20]">Settings & Sync</h3>
            <p class="text-xs font-semibold uppercase tracking-wider text-[#49454F]">P2P Multi-Device Sync</p>
          </div>
        </div>
        <button
          @click="store.isSettingsModalOpen = false"
          class="p-2 rounded-full text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7] active:scale-95 transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Settings Content -->
      <div class="flex-1 overflow-y-auto space-y-4 pr-1 text-xs sm:text-sm">
        <!-- Live Connection & Sync Action Card -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-3.5 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <span class="font-bold text-[#1D1B20] uppercase tracking-wider text-xs block">P2P Mesh Status</span>
              <span class="text-[11px] text-[#49454F]">Encrypted peer-to-peer data channels</span>
            </div>
            <span
              class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm flex items-center space-x-1.5"
              :class="[
                store.syncState.peerCount > 0 ? 'bg-[#E8DEF8] text-[#21005D] border border-[#CAC4D0]' :
                store.syncState.isRateLimited ? 'bg-rose-100 text-rose-900 border border-rose-300' :
                store.syncState.syncMode === 'discovering' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                store.syncState.syncMode === 'passive_listening' ? 'bg-indigo-50 text-indigo-900 border border-indigo-200' :
                store.syncState.signalingState === 'connected' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' :
                'bg-red-50 text-red-800 border border-red-200'
              ]"
            >
              <span
                class="w-2 h-2 rounded-full"
                :class="[
                  store.syncState.peerCount > 0 ? 'bg-emerald-600 animate-pulse' :
                  store.syncState.isRateLimited ? 'bg-rose-500 animate-pulse' :
                  store.syncState.syncMode === 'discovering' ? 'bg-amber-500 animate-ping' :
                  store.syncState.syncMode === 'passive_listening' ? 'bg-indigo-500' :
                  store.syncState.signalingState === 'connected' ? 'bg-emerald-500' :
                  'bg-red-500'
                ]"
              ></span>
              <span>
                <template v-if="store.syncState.peerCount > 0">
                  {{ store.syncState.peerCount }} {{ store.syncState.peerCount === 1 ? 'Peer Connected' : 'Peers Connected' }}
                </template>
                <template v-else-if="store.syncState.isRateLimited">
                  Rate Limited ({{ store.syncState.rateLimitRemaining }}s)
                </template>
                <template v-else-if="store.syncState.syncMode === 'discovering'">
                  Discovering Peers...
                </template>
                <template v-else-if="store.syncState.syncMode === 'passive_listening'">
                  Passive Listener (Ready)
                </template>
                <template v-else-if="store.syncState.signalingState === 'connected'">
                  Signaling Ready (0 peers)
                </template>
                <template v-else>
                  Signaling Offline
                </template>
              </span>
            </span>
          </div>

          <!-- PRIMARY ACTION: SYNC NOW BUTTON -->
          <div class="pt-1">
            <button
              @click="handleManualSync"
              :disabled="store.isSyncing"
              class="w-full py-3 px-4 bg-[#6750A4] hover:bg-[#533f86] active:scale-[0.99] disabled:opacity-75 text-white rounded-2xl font-bold uppercase tracking-wider text-xs sm:text-sm shadow-md transition-all flex items-center justify-center space-x-2.5"
            >
              <svg
                class="w-5 h-5"
                :class="{ 'animate-spin': store.isSyncing }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{{ store.isSyncing ? 'Synchronizing with Peers...' : 'Sync Now' }}</span>
            </button>

            <!-- Sync feedback alert if triggered -->
            <p v-if="syncFeedback" class="text-[11px] font-semibold text-emerald-800 text-center mt-2 animate-fade-in">
              {{ syncFeedback }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#49454F] pt-1">
            <div class="bg-[#F3F0F7] p-2.5 rounded-xl border border-[#CAC4D0]/60">
              <span class="text-[#79747E] block text-[10px] uppercase font-bold font-sans">Room ID</span>
              <span class="text-[#1D1B20] font-bold truncate block">{{ store.syncState.roomId ? store.syncState.roomId.substring(0, 12) + '...' : 'Not Joined' }}</span>
            </div>
            <div class="bg-[#F3F0F7] p-2.5 rounded-xl border border-[#CAC4D0]/60">
              <span class="text-[#79747E] block text-[10px] uppercase font-bold font-sans">My Peer ID</span>
              <span class="text-[#1D1B20] font-bold truncate block">{{ store.syncState.myPeerId || 'N/A' }}</span>
            </div>
          </div>

          <!-- Rate Limit Cooldown Notice Banner -->
          <div v-if="store.syncState.isRateLimited" class="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-900 space-y-1">
            <div class="font-bold flex items-center space-x-1.5">
              <svg class="w-4 h-4 text-rose-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Relay Rate Limit Cooldown</span>
            </div>
            <p class="text-rose-800 leading-normal">
              Public relay rate limit was reached. Outgoing discovery pings are temporarily paused to respect server limits. Resuming normal sync in <strong>{{ store.syncState.rateLimitRemaining }}s</strong>. Incoming peer connections are still received in real-time.
            </p>
          </div>

          <!-- Signaling Connection Diagnostic Banner -->
          <div v-else-if="store.syncState.signalingError || store.syncState.signalingState === 'error'" class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
            <div class="font-bold flex items-center space-x-1.5">
              <svg class="w-4 h-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Signaling Notice</span>
            </div>
            <p class="text-amber-800">
              {{ store.syncState.signalingError || 'Re-establishing connection to discovery network...' }}
            </p>
          </div>
        </div>

        <!-- DETAILED SYNC LOGS & DIAGNOSTICS CONSOLE -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-2.5 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="font-bold text-[#1D1B20] uppercase tracking-wider text-xs">Live Sync Logs</span>
              <span class="px-2 py-0.5 bg-[#E8DEF8] text-[#21005D] text-[10px] font-bold rounded-full font-mono">
                {{ filteredLogs.length }}
              </span>
            </div>
            <div class="flex items-center space-x-1.5">
              <button
                @click="copyLogs"
                class="px-2.5 py-1 bg-[#F3F0F7] hover:bg-[#E8DEF8] active:scale-95 border border-[#CAC4D0] text-[#1D1B20] rounded-lg text-[11px] font-semibold transition-colors flex items-center space-x-1"
                title="Copy full logs to clipboard"
              >
                <svg class="w-3.5 h-3.5 text-[#6750A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>{{ copiedText ? 'Copied!' : 'Copy' }}</span>
              </button>
              <button
                @click="clearLogs"
                class="px-2.5 py-1 bg-[#F3F0F7] hover:bg-red-50 text-[#49454F] hover:text-red-700 active:scale-95 border border-[#CAC4D0] rounded-lg text-[11px] font-semibold transition-colors"
                title="Clear in-memory logs"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Category filter buttons -->
          <div class="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px]">
            <button
              v-for="cat in ['ALL', 'SYNC', 'SIGNAL', 'WEBRTC']"
              :key="cat"
              @click="activeCategory = cat"
              class="px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] transition-colors"
              :class="activeCategory === cat ? 'bg-[#6750A4] text-white' : 'bg-[#F3F0F7] text-[#49454F] hover:bg-[#E8DEF8]'"
            >
              {{ cat }}
            </button>
          </div>

          <!-- Terminal Log Window -->
          <div
            ref="logContainer"
            class="bg-[#1D1B20] text-neutral-100 rounded-xl p-3 font-mono text-[11px] h-48 overflow-y-auto space-y-1.5 border border-[#49454F]/40 shadow-inner select-text"
          >
            <div v-if="filteredLogs.length === 0" class="text-neutral-500 italic py-6 text-center">
              No logs in this category. Tap "Sync Now" to trigger discovery.
            </div>

            <div
              v-for="log in filteredLogs"
              :key="log.id"
              class="leading-tight break-all transition-colors flex items-start space-x-1.5"
            >
              <span class="text-neutral-500 shrink-0 text-[10px]">{{ log.time }}</span>
              <span
                class="px-1 py-0.2 rounded text-[9px] font-extrabold uppercase shrink-0"
                :class="getCategoryBadgeClass(log.category)"
              >
                {{ log.category }}
              </span>
              <span
                class="flex-1"
                :class="getLevelTextClass(log.level)"
              >
                {{ log.message }}
              </span>
            </div>
          </div>
        </div>

        <!-- Phrase Configuration Card -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-3 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-[#1D1B20] uppercase tracking-wider text-xs">Shared Phrase</div>
              <div class="text-xs text-[#49454F] font-mono mt-0.5 font-bold">{{ store.maskedPhrase || 'None' }}</div>
            </div>
            <button
              @click="confirmResetPhrase"
              class="px-3.5 py-1.5 bg-red-100 hover:bg-red-200 border border-red-300 text-red-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
            >
              Change
            </button>
          </div>
          <p class="text-[11px] font-medium text-[#49454F]">
            Any devices using this exact shared phrase will automatically discover each other and sync lists in real-time.
          </p>
        </div>

        <!-- Custom Signaling URL & Presets -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-3 shadow-sm">
          <div class="flex items-center justify-between">
            <label class="block font-bold text-[#1D1B20] text-xs uppercase tracking-wider">
              Signaling Relay / Server
            </label>
            <span
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
              :class="store.syncState.signalingState === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
            >
              {{ store.syncState.signalingState === 'connected' ? 'Connected' : store.syncState.signalingState }}
            </span>
          </div>

          <div class="flex items-center space-x-2">
            <input
              v-model="signalingInput"
              type="text"
              placeholder="public"
              class="flex-1 bg-[#F3F0F7] border border-[#CAC4D0] rounded-xl px-3 py-2 text-xs text-[#1D1B20] font-mono focus:outline-none focus:border-[#6750A4]"
            />
            <button
              @click="saveSignalingUrl"
              class="px-4 py-2 bg-[#6750A4] hover:bg-[#533f86] active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              Save
            </button>
          </div>

          <!-- Quick presets -->
          <div class="space-y-1 pt-1">
            <span class="text-[10px] font-bold text-[#79747E] uppercase tracking-wider block">Quick Presets:</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                @click="applyPreset('public')"
                class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[11px] font-medium text-emerald-900 transition-colors"
                title="Global zero-setup public relay (default)"
              >
                🌐 Public Relay (Default)
              </button>
              <button
                @click="applyPreset('ws://localhost:8080')"
                class="px-2.5 py-1 bg-[#F3F0F7] hover:bg-[#E8DEF8] border border-[#CAC4D0] rounded-lg text-[11px] font-mono text-[#1D1B20] transition-colors"
              >
                Localhost (8080)
              </button>
              <button
                @click="applyPreset('ws://10.0.2.2:8080')"
                class="px-2.5 py-1 bg-[#F3F0F7] hover:bg-[#E8DEF8] border border-[#CAC4D0] rounded-lg text-[11px] font-mono text-[#1D1B20] transition-colors"
                title="Android Emulator host loopback"
              >
                Emulator (10.0.2.2:8080)
              </button>
            </div>

            <!-- Bridge & Self-Host Explanation -->
            <div class="mt-2 p-2.5 bg-[#F3F0F7] rounded-xl border border-[#CAC4D0]/60 space-y-1 text-[11px] text-[#49454F]">
              <div class="font-bold text-[#1D1B20] flex items-center space-x-1">
                <span>💡 PC Always-On Sync Bridge</span>
              </div>
              <p class="leading-relaxed">
                Keeping a browser tab open on your PC acts as an asynchronous bridge. In <em>Passive Listener Mode</em>, the tab holds an open WebSocket subscription with <strong>zero polling requests</strong> when idle, completely eliminating server rate-limiting and battery drain.
              </p>
              <p class="text-[10px] text-[#79747E] leading-normal">
                Want 100% private home sync without external servers? Run <code>signaling-server/</code> on your PC (port 8080) and enter <code>ws://&lt;PC-LAN-IP&gt;:8080</code> on your phones!
              </p>
            </div>
          </div>
        </div>

        <!-- Backup / Export Data -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-2 shadow-sm">
          <div class="font-bold text-[#1D1B20] text-xs uppercase tracking-wider">Data Backup & Export</div>
          <div class="flex items-center space-x-2 pt-1">
            <button
              @click="exportJsonBackup"
              class="px-3.5 py-2 bg-[#F3F0F7] hover:bg-[#E8DEF8] border border-[#CAC4D0] text-[#1D1B20] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5 active:scale-95"
            >
              <svg class="w-4 h-4 text-[#6750A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export JSON</span>
            </button>
            <label
              class="px-3.5 py-2 bg-[#F3F0F7] hover:bg-[#E8DEF8] border border-[#CAC4D0] text-[#1D1B20] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer active:scale-95"
            >
              <svg class="w-4 h-4 text-[#6750A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Import JSON</span>
              <input type="file" accept=".json" @change="importJsonBackup" class="hidden" />
            </label>
          </div>
        </div>

        <!-- App Version & Updates -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-3 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-[#1D1B20] uppercase tracking-wider text-xs">App Version & Updates</div>
              <div class="text-[11px] text-[#49454F] mt-0.5">OTA dynamic bundle updates</div>
            </div>
            <span
              class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border"
              :class="isAndroidApp ? 'bg-[#E8DEF8] text-[#21005D] border-[#CAC4D0]' : 'bg-blue-50 text-blue-900 border-blue-200'"
            >
              {{ isAndroidApp ? 'Android App' : 'Web Browser' }}
            </span>
          </div>

          <!-- Version details badge row -->
          <div class="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#49454F]">
            <div class="bg-[#F3F0F7] p-2.5 rounded-xl border border-[#CAC4D0]/60">
              <span class="text-[#79747E] block text-[10px] uppercase font-bold font-sans">Build Version</span>
              <span class="text-[#1D1B20] font-extrabold block text-xs">
                v{{ appVersion.versionName }}
                <span class="text-[10px] font-semibold text-[#6750A4] ml-1">#{{ appVersion.buildNumber }}</span>
              </span>
            </div>
            <div class="bg-[#F3F0F7] p-2.5 rounded-xl border border-[#CAC4D0]/60">
              <span class="text-[#79747E] block text-[10px] uppercase font-bold font-sans">Commit & Date</span>
              <span class="text-[#1D1B20] font-bold block truncate" :title="appVersion.gitSha">
                {{ appVersion.gitSha ? appVersion.gitSha.substring(0, 7) : 'dev' }}
                <span v-if="formattedBuildDate" class="text-[10px] text-[#79747E] font-normal font-sans ml-1">
                  ({{ formattedBuildDate }})
                </span>
              </span>
            </div>
          </div>

          <!-- Update status banner if check triggered -->
          <div
            v-if="updateCheckMessage"
            class="p-2.5 rounded-xl text-xs flex items-center space-x-2 border transition-all"
            :class="[
              updateCheckStatus === 'installed' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' :
              updateCheckStatus === 'up-to-date' ? 'bg-[#F3F0F7] text-[#21005D] border-[#CAC4D0]' :
              updateCheckStatus === 'error' ? 'bg-rose-50 text-rose-900 border-rose-300' :
              'bg-amber-50 text-amber-900 border-amber-300'
            ]"
          >
            <svg
              v-if="isCheckingUpdate"
              class="w-4 h-4 animate-spin text-amber-700 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span v-else class="text-sm shrink-0">
              {{ updateCheckStatus === 'installed' ? '🎉' : updateCheckStatus === 'up-to-date' ? '✓' : updateCheckStatus === 'error' ? '⚠️' : 'ℹ️' }}
            </span>
            <span class="font-medium flex-1">{{ updateCheckMessage }}</span>
          </div>

          <!-- Action buttons: Check for Updates & Reload -->
          <div class="flex items-center space-x-2 pt-1">
            <button
              @click="handleCheckForUpdates"
              :disabled="isCheckingUpdate"
              class="flex-1 py-2.5 px-3 bg-[#F3F0F7] hover:bg-[#E8DEF8] active:scale-95 disabled:opacity-60 text-[#1D1B20] rounded-xl text-xs font-bold uppercase tracking-wider border border-[#CAC4D0] transition-colors flex items-center justify-center space-x-1.5"
            >
              <svg
                class="w-4 h-4 text-[#6750A4]"
                :class="{ 'animate-spin': isCheckingUpdate }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{{ isCheckingUpdate ? 'Checking...' : 'Check for Updates' }}</span>
            </button>

            <button
              v-if="updateCheckStatus === 'installed' || isAndroidApp"
              @click="reloadApp"
              class="py-2.5 px-3.5 bg-[#6750A4] hover:bg-[#533f86] active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center space-x-1"
              title="Reload web view and apply latest bundle"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reload</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pt-3.5 border-t border-[#E6E0E9] flex justify-end">
        <button
          @click="store.isSettingsModalOpen = false"
          class="px-6 py-2.5 bg-[#6750A4] hover:bg-[#533f86] text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm active:scale-95"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useListStore } from '../stores/listStore.js';
import { syncLogger } from '../services/logger.js';

const store = useListStore();
const emit = defineEmits(['request-confirm']);

const signalingInput = ref(store.signalingUrl);
const syncFeedback = ref('');
const copiedText = ref(false);
const activeCategory = ref('ALL');
const logEntries = ref(syncLogger.getLogs());
const logContainer = ref(null);

const appVersion = ref({
  versionName: '1.0.0',
  buildNumber: 1,
  gitSha: '',
  builtAt: '',
  version: 0
});
const isAndroidApp = ref(false);
const isCheckingUpdate = ref(false);
const updateCheckStatus = ref('');
const updateCheckMessage = ref('');

const formattedBuildDate = computed(() => {
  if (!appVersion.value.builtAt) return '';
  try {
    const d = new Date(appVersion.value.builtAt);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return appVersion.value.builtAt;
  }
});

let unsubscribeLogger = null;

onMounted(() => {
  loadAppVersion();
  window.addEventListener('web-update-status', handleUpdateStatusEvent);

  unsubscribeLogger = syncLogger.onLog((_, allLogs) => {
    logEntries.value = [...allLogs];
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  });
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
});

onUnmounted(() => {
  if (unsubscribeLogger) unsubscribeLogger();
  window.removeEventListener('web-update-status', handleUpdateStatusEvent);
});

const filteredLogs = computed(() => {
  if (activeCategory.value === 'ALL') return logEntries.value;
  return logEntries.value.filter(l => l.category === activeCategory.value);
});

function getCategoryBadgeClass(category) {
  switch (category) {
    case 'SYNC': return 'bg-emerald-900 text-emerald-300';
    case 'SIGNAL': return 'bg-purple-900 text-purple-300';
    case 'WEBRTC': return 'bg-blue-900 text-blue-300';
    case 'STORE': return 'bg-amber-900 text-amber-300';
    default: return 'bg-neutral-800 text-neutral-300';
  }
}

function getLevelTextClass(level) {
  switch (level) {
    case 'error': return 'text-rose-400 font-semibold';
    case 'warn': return 'text-amber-300 font-semibold';
    case 'success': return 'text-emerald-400 font-medium';
    case 'debug': return 'text-neutral-400';
    default: return 'text-neutral-200';
  }
}

async function handleManualSync() {
  syncFeedback.value = 'Syncing...';
  const result = await store.syncNow();
  if (result && result.success) {
    syncFeedback.value = `✓ Sync signal dispatched (Active peers: ${result.activePeers})`;
  } else if (result && result.reason === 'no_room') {
    syncFeedback.value = 'Please set a shared phrase to join a room.';
  } else {
    syncFeedback.value = '✓ Sync broadcast completed';
  }
  setTimeout(() => {
    syncFeedback.value = '';
  }, 4000);
}

function copyLogs() {
  const text = logEntries.value
    .map(l => `[${l.time}][${l.category}][${l.level.toUpperCase()}] ${l.message}`)
    .join('\n');
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      copiedText.value = true;
      setTimeout(() => (copiedText.value = false), 2000);
    });
  }
}

function clearLogs() {
  syncLogger.clear();
  logEntries.value = [];
}

function applyPreset(url) {
  signalingInput.value = url;
  store.updateSignalingUrl(url);
}

function saveSignalingUrl() {
  if (signalingInput.value.trim()) {
    store.updateSignalingUrl(signalingInput.value.trim());
  }
}

function confirmResetPhrase() {
  emit('request-confirm', {
    title: 'Change / Reset Phrase?',
    message: 'Resetting the shared phrase will disconnect this device from the current WebRTC sync room. You will need to enter a new phrase to reconnect.',
    confirmText: 'Reset Phrase',
    confirmType: 'danger',
    action: () => store.resetPhrase()
  });
}

function exportJsonBackup() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(store.lists, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `simple_lists_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importJsonBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (Array.isArray(parsed)) {
        store.mergeRemoteState(parsed);
        alert('Data imported successfully!');
      }
    } catch (err) {
      alert('Invalid JSON backup file');
    }
  };
  reader.readAsText(file);
}

async function loadAppVersion() {
  isAndroidApp.value = !!(window.AndroidBridge && typeof window.AndroidBridge.checkForUpdate === 'function');
  try {
    const res = await fetch('./version.json?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      appVersion.value = {
        versionName: data.versionName || (data.buildNumber ? `1.0.${data.buildNumber}` : '1.0.0'),
        buildNumber: data.buildNumber || 1,
        gitSha: data.gitSha || '',
        builtAt: data.builtAt || '',
        version: data.version || 0
      };
    }
  } catch (err) {
    console.warn('Failed to load version.json', err);
  }
}

function handleUpdateStatusEvent(event) {
  const detail = event?.detail;
  if (!detail) return;
  console.log('web-update-status received:', detail);

  if (detail.status === 'checking') {
    isCheckingUpdate.value = true;
    updateCheckStatus.value = 'checking';
    updateCheckMessage.value = 'Checking for updates on GitHub...';
  } else if (detail.status === 'installed') {
    isCheckingUpdate.value = false;
    updateCheckStatus.value = 'installed';
    updateCheckMessage.value = `New build installed! Tap Reload to apply.`;
    loadAppVersion();
  } else if (detail.status === 'up-to-date') {
    isCheckingUpdate.value = false;
    updateCheckStatus.value = 'up-to-date';
    updateCheckMessage.value = 'App is running the latest build.';
  } else if (detail.status === 'error') {
    isCheckingUpdate.value = false;
    updateCheckStatus.value = 'error';
    updateCheckMessage.value = detail.message || 'Update check failed. Verify network connection.';
  }
}

async function handleCheckForUpdates() {
  isCheckingUpdate.value = true;
  updateCheckStatus.value = 'checking';
  updateCheckMessage.value = 'Checking for updates...';

  if (isAndroidApp.value) {
    window.AndroidBridge.checkForUpdate(true);
    setTimeout(() => {
      if (isCheckingUpdate.value) {
        isCheckingUpdate.value = false;
        if (updateCheckStatus.value === 'checking') {
          updateCheckStatus.value = 'error';
          updateCheckMessage.value = 'Update check timed out. Please try again.';
        }
      }
    }, 12000);
  } else {
    try {
      const remoteRes = await fetch('https://wurzelkuchen.github.io/SimpleLists/version.json?t=' + Date.now());
      if (remoteRes.ok) {
        const remoteData = await remoteRes.json();
        const currentVer = appVersion.value.version || 0;
        const currentBuild = appVersion.value.buildNumber || 0;
        if ((remoteData.version && remoteData.version > currentVer) || (remoteData.buildNumber && remoteData.buildNumber > currentBuild)) {
          updateCheckStatus.value = 'installed';
          updateCheckMessage.value = `New version available (v${remoteData.versionName || remoteData.buildNumber})! Reload to update.`;
        } else {
          updateCheckStatus.value = 'up-to-date';
          updateCheckMessage.value = 'App is running the latest build.';
        }
      } else {
        updateCheckStatus.value = 'error';
        updateCheckMessage.value = 'Could not reach update server.';
      }
    } catch (e) {
      updateCheckStatus.value = 'error';
      updateCheckMessage.value = 'Network error checking for updates.';
    } finally {
      isCheckingUpdate.value = false;
    }
  }
}

function reloadApp() {
  if (window.AndroidBridge && typeof window.AndroidBridge.reloadApp === 'function') {
    window.AndroidBridge.reloadApp();
  } else {
    window.location.reload();
  }
}
</script>
